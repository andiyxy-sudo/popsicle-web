// Every `accounts` column a signed-in user may read. Never select('*') on accounts: SELECT on
// enrichment_data (the AI profile, which can summarise a locked Concern) is revoked for the user role,
// and a '*' asks for it, so Postgres refuses the WHOLE query and the page silently gets no accounts.
// The profile parts the UI may show come from the view account_profile (id, contacts, health_score,
// communication_summary), joined on id. Keep this list in step with the table.
export const ACCOUNT_COLUMNS =
  'id, user_id, name, value, stage, owner, risk_level, probability, close_date, health_score, tags, created_at, enriched_at, enrichment_source, last_contact_date, domain, contact_name, contact_email, contact_phone' as const
