// Detect revenue-risk signals in a single piece of sales communication.
//
// POST body: { content: string, account_name?: string, source_integration?: string, source_message_id?: string, user_id?: string }
// Response:  { signal: SignalRow | null }
//
// The Anthropic key lives in Supabase secrets (ANTHROPIC_API_KEY) and never
// touches the app. When the secret is missing the function returns 501 with
// a clear hint so the caller knows what to set.
//
// v25 (calibration review): NEAR-DUPLICATE SUPPRESSION. See the block above the
// insert for why, and what the corpus showed.
//
// v27: TRUSTED SERVER CALLS. The background syncs (oauth-gmail's scheduled sync)
// call this with the service-role key + the user's id in the body, exactly as
// oauth-gmail itself accepts. Before v27 this function only accepted a signed-in
// user's JWT, so every background call was turned away with 401 and new mail
// picked up by the scheduled sync was never checked for Concerns. Server calls
// read with the service role, so every query here is scoped to the user
// explicitly (the account lookup was not, and would otherwise have matched
// against every user's accounts).
//
// v28 (5 Oct 2026): "EARLY WARNING" NOW REACHES THE MODEL. The confidence floor was
// a fixed 0.7, in the prompt and in code, before any setting was read, so Early
// warning produced exactly what Balanced did. The floor now comes from the
// person's Concern Engine sensitivity (user_metadata.concern_engine.sens): 0.5 for
// Early warning, 0.7 otherwise. 0.5 rather than 0, because asking the model for
// anything at all returns noise. The person's exact bar (0 / 70 / 90) and their
// type switches are then applied by the database trigger signals_concern_engine,
// which covers every producer, not just this one. Confidence is also normalised
// before the check: a 0-100 reply of 65 used to pass the 0.7 test.
//
// Required env: ANTHROPIC_API_KEY  (set via: supabase secrets set ANTHROPIC_API_KEY=sk-...)
// Optional env: ANTHROPIC_MODEL    (default 'claude-sonnet-4-5'; do NOT use date-stamped ids that don't exist)
//
// NB: env vars are .trim()'d defensively - Supabase Dashboard sometimes adds
// trailing whitespace when pasting secrets, which would otherwise break the
// Anthropic x-api-key header silently with a confusing 401.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });

const systemPrompt = (floor: number) => `You are a revenue intelligence AI. Analyse the following sales communication and detect signals.

Return ONE JSON object only (no prose, no code fences) matching this exact shape:
{
  "signal_type": "silent_stall" | "competitor_mention" | "legal_loopin" | "price_flinch" | "champion_change" | "timeline_slip" | "reengaged",
  "severity": "high" | "watch" | "positive",
  "title": string,                  // <=40 chars. A VERDICT, not a sentence: subject + judgment
                                    // ("Champion looping in legal", "Investor re-engaged"). See TITLE CONTRACT below.
  "description": string,            // The full case: complete sentences with the specifics (names,
                                    // numbers, what happened, why it matters). Title is the verdict; this is the detail. Do NOT restate the title.
  "risk_amount": number,            // estimated $ at risk, 0 if positive
  "account_name": string,
  "confidence": number,             // 0..1
  "ai_analysis": {
    "summary": string,              // REQUIRED: 1-sentence plain-language description
    "reason": string,               // REQUIRED: brief why this triggers the signal type
    "contact_name": string,         // sender's name from From field / signature / body
    "sender_email": string,         // sender's email address
    "thread_subject": string,       // subject line of the email/message
    "quote": string,                // EXACT verbatim phrase that triggered detection
    "evidence": string,             // 1-2 sentences of context around the quote
    "thread_date": string,          // ISO date (YYYY-MM-DD) of the message if present
    "additional_context": {
      "previous_concerns": string[],                       // concerns visible in the thread
      "engagement_pattern": "increasing" | "stable" | "decreasing",  // infer from tone/cadence
      "key_phrases": string[],                             // notable phrases from the message
      "cc_parties": string[]                               // other people on the thread (emails)
    }
  }
}

Rules:
- Only emit a signal when confidence > ${floor}. Otherwise return: null
- Output null (literal four characters n-u-l-l) and nothing else when no signal is detected.
- ai_analysis.summary and ai_analysis.reason are REQUIRED. For every other ai_analysis
  field: extract it ONLY from what is actually present in the message - if you cannot
  determine a field confidently, OMIT it entirely. Never invent names, emails, dates or quotes.
- "quote" must be copied verbatim from the message text, not paraphrased.
- TITLE CONTRACT (strict):
  - title aims for ~34 characters, HARD MAXIMUM 40. Count them. If it runs long, cut words, not meaning, until it is a clean short phrase.
  - title is a VERDICT: the subject plus the judgment ("Buyer flagged pricing", "Investor re-engaged", "Champion looping in legal"). Not a full sentence, no ending punctuation, no ellipsis, never a mid-thought cut.
  - title is FACTUAL, drawn strictly from the message. No drama, no words the evidence does not support.
  - HONESTY ON ROLES: name a role/person in the title ONLY if the message identifies them. If the sender is clearly the CFO, "CFO flagged pricing" is fine; otherwise use a neutral subject ("Buyer flagged pricing", "Pricing flagged"). Never upgrade an unknown into a titled role.
  - title and description must NOT be redundant: title = the verdict, description = the case.
- Never use em dashes or en dashes (the long dash punctuation) in any string value. Use commas, colons, or periods instead. This is a strict formatting requirement.
- No markdown, no explanation, no leading whitespace before the JSON.
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // .trim() defensive - Supabase Dashboard sometimes adds trailing whitespace
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
  if (!apiKey) {
    return json({
      error: "anthropic_key_missing",
      hint: "Run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...",
    }, 501);
  }
  const model = Deno.env.get("ANTHROPIC_MODEL")?.trim() ?? "claude-sonnet-4-5";

  // Auth: a signed-in app user, OR a trusted server call (the service-role key + the user's id in the body) from
  // the background syncs. See v27 above.
  const SUPA_URL  = Deno.env.get("SUPABASE_URL")!.trim();
  const SUPA_ANON = Deno.env.get("SUPABASE_ANON_KEY")!.trim();
  const SERVICE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  const authHeader = req.headers.get("authorization") || "";
  const body = await req.json().catch(() => ({}));
  const isServiceCall = !!SERVICE_KEY && authHeader === `Bearer ${SERVICE_KEY}` && typeof body.user_id === "string" && body.user_id.length > 0;

  let supa: ReturnType<typeof createClient>;
  let user: { id: string };
  let meta: Record<string, unknown> = {};
  if (isServiceCall) {
    supa = createClient(SUPA_URL, SERVICE_KEY);
    const { data: u } = await supa.auth.admin.getUserById(body.user_id);
    if (!u?.user) return json({ error: "unknown_user" }, 400);
    user = { id: u.user.id };
    meta = (u.user.user_metadata ?? {}) as Record<string, unknown>;
  } else {
    supa = createClient(SUPA_URL, SUPA_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser } } = await supa.auth.getUser();
    if (!authUser) return json({ error: "unauthorized" }, 401);
    user = { id: authUser.id };
    meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  }

  // v28: the confidence floor follows the person's Concern Engine sensitivity.
  const ce = (meta.concern_engine ?? {}) as Record<string, unknown>;
  const floor = ce.sens === "Early warning" ? 0.5 : 0.7;

  const content: string = body.content ?? "";
  if (!content || content.length > 20_000) {
    return json({ error: "invalid_content", note: "1..20000 chars" }, 400);
  }

  // ── Baseline context (Step 3): if the sender maps to one of the user's
  // accounts that has a computed baseline, give Claude the contact's normal
  // behaviour so severity reflects DEVIATION from baseline, not absolutes. ──
  let baselineBlock = "";
  try {
    const fromLine = (content.match(/From:\s*(.+)/i) || [])[1] || "";
    const em = (fromLine.match(/<([^>]+)>/)?.[1] || fromLine).trim().toLowerCase();
    const domain = em.indexOf("@") >= 0 ? em.split("@")[1] : "";
    if (domain) {
      // scoped to this user explicitly (server calls bypass row-level security)
      const { data: accs } = await supa.from("accounts").select("id, name, domain").eq("user_id", user.id).limit(200);
      let matchId = "";
      // Pass 1: exact domain match (root or subdomain) - robust for any account.
      for (const a of (accs ?? [])) {
        const adom = String(a.domain || "").toLowerCase().trim();
        if (adom && (domain === adom || domain.endsWith("." + adom))) { matchId = a.id; break; }
      }
      // Pass 2: legacy/manual accounts with no domain - first-word-of-name fallback.
      if (!matchId) {
        for (const a of (accs ?? [])) {
          if (String(a.domain || "").trim()) continue;
          const key = String(a.name || "").toLowerCase().split(" ")[0].replace(/[^a-z0-9]/g, "");
          if (key.length >= 4 && domain.indexOf(key) >= 0) { matchId = a.id; break; }
        }
      }
      if (matchId) {
        const { data: bl } = await supa.from("account_baselines").select("*").eq("account_id", matchId).maybeSingle();
        if (bl && (bl.total_reply_pairs > 0 || bl.total_messages >= 5)) {
          const parts: string[] = [];
          if (bl.their_median_reply_hours != null) parts.push("they usually reply within " + bl.their_median_reply_hours + "h");
          if (bl.emails_per_week != null) parts.push("they send ~" + bl.emails_per_week + " emails/week");
          if (bl.median_interval_hours != null) parts.push("their typical gap between messages is " + bl.median_interval_hours + "h");
          if (bl.their_response_rate != null) parts.push("their response rate is " + bl.their_response_rate + "%");
          if (bl.last_message_at) {
            const gapH = Math.round((Date.now() - new Date(bl.last_message_at).getTime()) / 3600000);
            parts.push("their last message was ~" + gapH + "h ago");
          }
          if (parts.length) {
            baselineBlock = "\n\nBASELINE for this contact (from message history): " + parts.join("; ") +
              ".\nWeigh severity by DEVIATION from this baseline. A gap many times their normal reply time is significant; a normal gap is not. " +
              "If you flag a signal, include ai_analysis.baseline_deviation = {metric, baseline_hours, actual_hours, multiplier, direction, confidence} when reply-time deviation drives it.";
          }
        }
      }
    }
  } catch {/* baseline is best-effort; never blocks detection */}

  // Call Anthropic Messages API.
  const aResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      system: systemPrompt(floor),
      messages: [{ role: "user", content: content + baselineBlock }],
    }),
  });
  if (!aResp.ok) {
    const detail = await aResp.text().catch(() => "");
    return json({ error: "anthropic_call_failed", status: aResp.status, detail: detail.slice(0, 400) }, 502);
  }
  const aJson = await aResp.json();
  const text = (aJson.content?.[0]?.text ?? "").trim();

  // Anthropic might return literal "null" when no signal detected.
  if (text === "null" || text === "") return json({ signal: null });

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch { return json({ signal: null, parse_error: text.slice(0, 200) }); }

  if (!parsed || typeof parsed !== "object" || !parsed.signal_type) {
    return json({ signal: null });
  }
  if (typeof parsed.confidence === "number") {
    const c = parsed.confidence > 1 ? parsed.confidence / 100 : parsed.confidence;   // 0-1 or 0-100, compared as 0-1
    if (c <= floor) return json({ signal: null, low_confidence: parsed.confidence, floor });
  }

  // ai_analysis: prefer the rich nested object Claude returns; fall back to a
  // minimal one synthesized from the top-level fields for older-shape replies.
  // We also fold in confidence so downstream consumers can read it from one place.
  const rich = (parsed.ai_analysis && typeof parsed.ai_analysis === "object") ? parsed.ai_analysis : null;
  const aiAnalysis: Record<string, unknown> = rich ?? {
    summary: parsed.description ?? parsed.title ?? "Signal detected",
    reason:  parsed.title ?? "",
  };
  // Fold in + normalize confidence to a CANONICAL 0-100 integer before storing.
  // The model emits either a 0-1 fraction (0.78) or a 0-100 number (78); storing
  // one format keeps downstream averages sane (the "3942% avg confidence" bug).
  // Covers both the nested ai_analysis.confidence and the top-level parsed.confidence.
  {
    const rawConf = (typeof aiAnalysis.confidence === "number") ? aiAnalysis.confidence as number
      : (typeof parsed.confidence === "number") ? parsed.confidence : null;
    if (rawConf != null) {
      aiAnalysis.confidence = Math.min(100, Math.max(0, Math.round(rawConf <= 1 ? rawConf * 100 : rawConf)));
    }
  }

  // Persist to public.signals (user_id is always this user: from the JWT, or the verified id of a server call).
  const row = {
    user_id:            user.id,
    account_name:       parsed.account_name ?? body.account_name ?? null,
    signal_type:        parsed.signal_type,
    severity:           parsed.severity ?? "watch",
    title:              parsed.title ?? null,
    description:        parsed.description ?? null,
    source_integration: body.source_integration ?? null,
    source_message_id:  body.source_message_id ?? null,
    risk_amount:        parsed.risk_amount ?? null,
    raw_content:        content.slice(0, 4000),
    ai_analysis:        aiAnalysis,
  };

  // ── NEAR-DUPLICATE SUPPRESSION (calibration review, 2026-08-27) ─────
  // This producer had NO dedup of any kind: one insert per message, always. The
  // calibration corpus shows what that costs. Two rows were verdicted duplicate:
  //   - one forwarded email sent twice 2m16s apart, the second only adding a
  //     missed cc, which surfaced as a "block" and an "escalation";
  //   - one investor reply quoted identically by two messages in a thread.
  // Neither is a second event. Same account, same concern, same evidence, inside
  // a short window is ONE thing happening, and a feed that says it twice is
  // asking the user to triage its own repetition.
  //
  // The key is the EVIDENCE, not the title: the model paraphrases titles freely
  // (that is exactly how the same email became "block" and "escalating"), so
  // titles would not have caught either case. Quote/description text does.
  const dedupWindowHours = 24;
  const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const evidenceOf = (a: Record<string, unknown> | null, desc: string | null) =>
    norm((a && (a.quote as string)) || desc || "").slice(0, 220);
  const newEvidence = evidenceOf(aiAnalysis, row.description);
  if (newEvidence.length >= 40 && row.account_name) {
    const since = new Date(Date.now() - dedupWindowHours * 3600_000).toISOString();
    const { data: recent } = await supa.from("signals")
      .select("id, title, description, ai_analysis, created_at")
      .eq("user_id", user.id).eq("account_name", row.account_name)
      .neq("status", "deleted")           // a corrected-as-wrong row must not suppress a fresh one
      .gte("created_at", since)
      .order("created_at", { ascending: false }).limit(20);
    for (const r of (recent ?? [])) {
      const prior = evidenceOf((r as any).ai_analysis ?? null, (r as any).description ?? null);
      if (prior.length < 40) continue;
      // Containment, not equality: a forward wraps the original body, so the
      // second message's evidence often CONTAINS the first rather than matching
      // it byte for byte.
      if (prior === newEvidence || prior.includes(newEvidence) || newEvidence.includes(prior)) {
        return json({
          ok: true, deduped: true, duplicate_of: (r as any).id,
          reason: "same account and same evidence within " + dedupWindowHours + "h",
          signal: parsed,
        });
      }
    }
  }

  const { data: saved, error } = await supa.from("signals").insert(row).select().single();
  if (error) {
    return json({ error: "db_insert_failed", detail: error.message, signal: parsed }, 500);
  }

  // ── Phase 2a auto-post (gated, default OFF) ────────────────────────
  // Only high-severity signals, and only when the user explicitly enabled
  // slack_autopost. Best-effort: delegates to post-to-slack (which owns channel
  // resolution, Block Kit, dedup + error handling) and never blocks the reply.
  let autoposted = false;
  try {
    if (saved && saved.severity === "high") {
      const { data: slackInteg } = await supa.from("integrations")
        .select("is_active, slack_autopost")
        .eq("user_id", user.id).eq("provider", "slack").maybeSingle();
      if (slackInteg && slackInteg.is_active && slackInteg.slack_autopost) {
        const r = await fetch(`${SUPA_URL}/functions/v1/post-to-slack`, {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": authHeader, "apikey": SUPA_ANON },
          body: JSON.stringify({ signal_id: saved.id, user_id: isServiceCall ? user.id : undefined }),
        });
        const pj = await r.json().catch(() => ({}));
        autoposted = !!pj.ok;
      }
    }
  } catch {/* auto-post is best-effort; never blocks detection */}

  return json({ signal: saved, autoposted });
});
