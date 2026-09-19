-- ============================================================
-- Document signing (Phase 6) — a separate flow from video-call
-- consent: staff author a document template with {{variables}},
-- customers fill in their details in a live preview and sign
-- (typed name or drawn signature), producing a permanent record.
-- Run with: supabase db push  (or paste into SQL editor)
-- ============================================================

-- ---------- Document templates ----------
create table document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version int not null default 1,
  -- body: the document text/HTML with {{variable}} placeholders
  body text not null default '',
  -- variables: [{key, label, required}] — same shape as templates.variables
  variables jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Document sessions — the central record ----------
create type document_session_status as enum
  ('pending', 'active', 'completed', 'expired');

create table document_sessions (
  id uuid primary key default gen_random_uuid(),
  document_template_id uuid not null references document_templates(id),
  template_version int not null, -- pinned at creation time, for audit stability
  agent_id uuid not null references profiles(id),
  access_token text not null unique, -- 64-char hex, the customer's only credential
  customer_name text not null,
  customer_phone text,
  customer_email text,
  variable_values jsonb not null default '{}'::jsonb, -- pinned for audit
  status document_session_status not null default 'pending',
  -- signature_type/data are set together at signing time
  signature_type text, -- 'typed' | 'drawn'
  signature_data text, -- typed: the name string; drawn: storage path of the PNG
  signed_document_path text, -- storage path of the final rendered document snapshot
  signed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index document_sessions_agent_idx on document_sessions(agent_id);
create index document_sessions_status_idx on document_sessions(status);

-- ---------- Document-flow lifecycle log ----------
-- A parallel table to recording_lifecycle_events rather than reusing it:
-- that table has a hard FK to sessions(id), which document_sessions rows
-- can't satisfy.
create table document_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  document_session_id uuid references document_sessions(id) on delete set null,
  correlation_id text not null,
  event_type text not null,
  severity text not null default 'info', -- info | warn | error
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index doc_lifecycle_session_idx on document_lifecycle_events(document_session_id);
create index doc_lifecycle_correlation_idx on document_lifecycle_events(correlation_id);

-- ---------- updated_at maintenance ----------
create trigger document_templates_touch before update on document_templates
  for each row execute function touch_updated_at();
create trigger document_sessions_touch before update on document_sessions
  for each row execute function touch_updated_at();

-- ============================================================
-- Row Level Security — same shape as templates/sessions:
-- customer traffic never touches the DB directly, it goes
-- through token-validated API routes using the service role.
-- ============================================================

alter table document_templates enable row level security;
alter table document_sessions enable row level security;
alter table document_lifecycle_events enable row level security;

-- document_templates: all staff read, admin writes
create policy "staff read document templates" on document_templates for select
  using (auth.uid() is not null);
create policy "admin insert document templates" on document_templates for insert
  with check (is_admin());
create policy "admin update document templates" on document_templates for update
  using (is_admin());

-- document_sessions: agents see own, admins see all
create policy "agent reads own document sessions" on document_sessions for select
  using (agent_id = auth.uid() or is_admin());
create policy "agent creates document sessions" on document_sessions for insert
  with check (agent_id = auth.uid());
create policy "admin updates document sessions" on document_sessions for update
  using (is_admin());
create policy "admin deletes document sessions" on document_sessions for delete
  using (is_admin());

create policy "admin reads document lifecycle" on document_lifecycle_events for select
  using (is_admin());

-- ============================================================
-- Storage bucket for signed documents + drawn-signature images.
-- Private, no objects RLS policy (same pattern as `recordings`):
-- all access goes through supabaseAdmin() issuing signed URLs.
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('signed-documents', 'signed-documents', false)
on conflict (id) do nothing;
