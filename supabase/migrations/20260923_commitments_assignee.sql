-- APPLIED to project jvxfcvkxaqwcnkrxexso on 2026-09-23 (migration "commitments_assignee"). Kept as the record.
-- commitments.owner records WHO MADE the promise ('us' | 'them' | 'unattributed') and keeps that meaning.
-- assignee is the person responsible, by name, when one is known (for example the owner named on a decision
-- in a pipeline review). Nullable: existing rows and detected commitments simply have none.
alter table public.commitments add column if not exists assignee text;
comment on column public.commitments.owner is 'Who made the promise: us | them | unattributed';
comment on column public.commitments.assignee is 'The person responsible, by name, when known. Nullable.';
notify pgrst, 'reload schema';
