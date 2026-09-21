// Verdict mode. A question that is really yes/no ("is this real", "will Acme close",
// "should I discount") is answered with a one-line verdict first, then the reasons,
// then the sources. Shared by the portal (/api/ask) and Slack (@popsicle).

const YES_NO = /^(is|are|was|were|will|would|should|shall|can|could|do|does|did|has|have|had|am)\b/i
const VERDICTY = /\b(real|true|at risk|going to close|close this|worth|safe to|on track|committed|slipping|lost|legit|actually)\b/i

export function wantsVerdict(question: string): boolean {
  const q = question.trim().replace(/^@\S+\s*/, '')
  return YES_NO.test(q) || (VERDICTY.test(q) && /\?\s*$/.test(q))
}

export const VERDICT_RULES = `This is a yes/no question, so answer it like a verdict.
First line, exactly: "Verdict: " followed by one of Yes, No, Probably, Probably not, Too early to tell, then a dash and a short reason of at most twelve words. Example: "Verdict: Probably not - CFO silent 8 days after four opens."
Then up to three short lines, each opening with a two-word bold lead such as **The signal:**, **What changed:**, **Do next:**.
Then a line "Sources:" listing only sources that appear in the context (email thread, signal, call, commitment, deal record), comma separated.
Commit to an answer. Do not hedge the verdict line. Under 110 words in total.`
