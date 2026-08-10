-- =========================================================================
-- FortunIQ OS — Migration: AI Security & Information Classification
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
-- =========================================================================

-- ---------- CLASSIFICATION ----------
-- Every document gets a classification level. General and Internal are
-- available to anyone with Documents access (the existing Documents
-- module rules already handle that). Confidential and Highly Confidential
-- require EXPLICIT authorisation — by role, by named individual, or both
-- — regardless of whether someone can otherwise see the Documents module.
-- The default is "Internal" — a document doesn't become sensitive by
-- accident; someone has to deliberately mark it Confidential or above.
alter table documents
  add column if not exists classification text not null default 'Internal'
    check (classification in ('General', 'Internal', 'Confidential', 'Highly Confidential'));

-- Roles allowed to see a Confidential/Highly Confidential document, on top
-- of whatever the classification itself requires. Ignored for
-- General/Internal documents. Empty/null on a Confidential+ document
-- means nobody gets access via role — only named individuals in
-- authorized_emails, or Super Admin.
alter table documents
  add column if not exists authorized_roles text[] not null default '{}';

-- Specific named individuals authorised to see a Confidential/Highly
-- Confidential document, regardless of their role — this is how you'd
-- handle "only these three board members" or "only the CFO and the
-- Financial Manager" style access.
alter table documents
  add column if not exists authorized_emails text[] not null default '{}';

-- Hard override: when true, this document is NEVER included in anything
-- the AI Assistant sees or references, regardless of classification,
-- role, or explicit authorisation. This is separate from classification
-- because a document can be perfectly fine for authorised humans to read
-- in the Documents module, while still being something you never want an
-- AI model processing (e.g. for confidentiality, legal privilege, or
-- simply an abundance of caution on especially sensitive material).
alter table documents
  add column if not exists ai_excluded boolean not null default false;

comment on column documents.classification is
  'General, Internal, Confidential, or Highly Confidential. See docs/AI_SECURITY.md.';
comment on column documents.authorized_roles is
  'Roles allowed to see this document if classification is Confidential or above. Ignored for General/Internal.';
comment on column documents.authorized_emails is
  'Specific people allowed to see this document if classification is Confidential or above, regardless of role.';
comment on column documents.ai_excluded is
  'If true, this document is never shown to or read by the AI Assistant, under any circumstances.';

-- Existing documents default to Internal with no special restrictions —
-- deliberately the least surprising outcome for data that already
-- existed before this migration ran. Go through your real documents
-- afterwards and mark anything that's actually HR, payroll, banking,
-- board, legal, or executive material as Confidential or Highly
-- Confidential — this migration cannot know which of your existing
-- documents are sensitive; only a person can classify them correctly.

-- ---------- AI SECURITY LOGS ----------
-- A dedicated, separate log from the general audit_logs table (see
-- migration_v5), because AI interactions have a distinct shape worth
-- tracking on their own: which data sources were actually available to
-- the model for a given question, not just "the AI Assistant was used."
create table ai_security_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_email text not null,
  actor_name text,
  ai_module text not null default 'chat',
  data_sources_accessed jsonb,
  proposed_action text,
  approved_by text,
  execution_outcome text not null default 'answered',
  message_length int,
  error text
);

create index ai_security_logs_created_at_idx on ai_security_logs (created_at desc);
create index ai_security_logs_actor_email_idx on ai_security_logs (actor_email);

alter table ai_security_logs enable row level security;
create policy "No public access to ai_security_logs" on ai_security_logs for all using (false);

comment on table ai_security_logs is
  'Security-relevant record of AI Assistant use: who, when, which documents were available to the model — deliberately never the prompt text or document content itself. Visible in-app to Super Admin and HR/Admin, same as audit_logs. See docs/AI_SECURITY.md.';
