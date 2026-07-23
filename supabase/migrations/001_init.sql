-- ============================================================
-- Welcome Call Platform — full schema
-- Run with: supabase db push  (or paste into SQL editor)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Roles / profiles ----------
create type user_role as enum ('admin', 'agent');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'agent',
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Templates (Phase 1) ----------
create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version int not null default 1,
  language text not null default 'en-US',
  recording_mode text not null default 'browser', -- browser | fallback
  consent_language text not null default 'This call will be recorded for compliance purposes.',
  webhook_url text,
  -- questions: [{id, order, text, video_url}]
  questions jsonb not null default '[]'::jsonb,
  -- variables: [{key, label, required}]
  variables jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Sessions (Phase 2) — the central record ----------
create type session_status as enum
  ('pending', 'active', 'completed', 'approved', 'requires_review', 'expired', 'failed');

create type assembly_status as enum
  ('not_started', 'awaiting_segments', 'queued', 'processing', 'done', 'failed');

create type recovery_state as enum
  ('none', 'flagged', 'in_recovery', 'resolved', 'unrecoverable');

create table sessions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id),
  template_version int not null,
  agent_id uuid not null references profiles(id),
  access_token text not null unique, -- 64-char hex, the customer's only credential
  customer_name text not null,
  customer_phone text,
  customer_email text,
  customer_address text,
  variable_values jsonb not null default '{}'::jsonb, -- pinned for audit
  status session_status not null default 'pending',
  assembly_status assembly_status not null default 'not_started',
  recovery_state recovery_state not null default 'none',
  recovery_reason text, -- corrupt | too_short | missing | cut_off
  expected_segment_count int,
  recorder_source text, -- browser | cloud
  video_url text,
  video_duration_ms bigint,
  consent_at timestamptz,
  consent_meta jsonb, -- location (best-effort), device info
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_agent_idx on sessions(agent_id);
create index sessions_status_idx on sessions(status);
create index sessions_recovery_idx on sessions(recovery_state) where recovery_state <> 'none';

-- ---------- Segments (Phase 4) ----------
create table session_segments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  take_id text not null,        -- one recorder spawn = one take
  segment_index int not null,   -- order within the take
  storage_path text not null,   -- deterministic: sessions/{sid}/takes/{take}/seg-{index}.webm
  size_bytes bigint,
  duration_ms int,
  mime_type text default 'video/webm',
  created_at timestamptz not null default now(),
  unique (session_id, take_id, segment_index) -- idempotent registration
);

create index segments_session_idx on session_segments(session_id);

-- ---------- Takes / final videos (Phase 5) ----------
create table session_takes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  take_index int not null default 0,
  storage_path text not null,
  is_stitched boolean not null default false,
  is_snapshot boolean not null default false,
  source text not null default 'browser', -- browser | cloud
  duration_ms bigint,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

-- ---------- Answers (Phase 3) ----------
create table session_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  question_id text not null,
  answer text not null, -- yes | no
  transcript text,      -- speech recognition capture, best-effort
  answered_at timestamptz not null default now(),
  unique (session_id, question_id) -- idempotent: re-answer overwrites via upsert
);

-- ---------- Client telemetry ----------
create table session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  event_type text not null, -- compositor_health, upload_ok, upload_fail, recorder_error, ...
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_session_idx on session_events(session_id);

-- ---------- Server-side lifecycle log (full audit trail) ----------
create table recording_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete set null,
  correlation_id text not null,
  event_type text not null,
  severity text not null default 'info', -- info | warn | error
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index lifecycle_session_idx on recording_lifecycle_events(session_id);
create index lifecycle_correlation_idx on recording_lifecycle_events(correlation_id);

-- ---------- Stitch job queue (Phase 5) ----------
create type stitch_status as enum ('queued', 'processing', 'done', 'failed');

create table stitch_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  status stitch_status not null default 'queued',
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stitch_queue_idx on stitch_jobs(status, created_at);

-- ---------- Immutable audit log ----------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  actor_id uuid,
  actor_type text not null default 'user', -- user | system | customer
  created_at timestamptz not null default now()
);

-- Audit logs are append-only: block updates/deletes
create or replace function block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end $$;

create trigger audit_logs_immutable
  before update or delete on audit_logs
  for each row execute function block_mutation();

-- ---------- Webhook outbox (retried delivery) ----------
create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  url text not null,
  event text not null, -- completed | approved | requires_review
  payload jsonb not null,
  status text not null default 'pending', -- pending | delivered | failed
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now()
);

create index webhook_pending_idx on webhook_deliveries(status, next_attempt_at);

-- ---------- updated_at maintenance ----------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger sessions_touch before update on sessions
  for each row execute function touch_updated_at();
create trigger templates_touch before update on templates
  for each row execute function touch_updated_at();
create trigger stitch_jobs_touch before update on stitch_jobs
  for each row execute function touch_updated_at();

-- ============================================================
-- Row Level Security
-- Customer traffic NEVER touches the DB directly — it goes
-- through token-validated API routes using the service role.
-- RLS below governs logged-in admin/agent dashboard reads.
-- ============================================================

alter table profiles enable row level security;
alter table templates enable row level security;
alter table sessions enable row level security;
alter table session_segments enable row level security;
alter table session_takes enable row level security;
alter table session_answers enable row level security;
alter table session_events enable row level security;
alter table recording_lifecycle_events enable row level security;
alter table stitch_jobs enable row level security;
alter table audit_logs enable row level security;
alter table webhook_deliveries enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles
create policy "read own profile" on profiles for select using (id = auth.uid() or is_admin());

-- templates: all staff read, admin writes
create policy "staff read templates" on templates for select using (auth.uid() is not null);
create policy "admin insert templates" on templates for insert with check (is_admin());
create policy "admin update templates" on templates for update using (is_admin());

-- sessions: agents see own, admins see all
create policy "agent reads own sessions" on sessions for select
  using (agent_id = auth.uid() or is_admin());
create policy "agent creates sessions" on sessions for insert
  with check (agent_id = auth.uid());
create policy "admin updates sessions" on sessions for update using (is_admin());

-- child tables: visible if parent session is visible
create policy "read segments" on session_segments for select
  using (exists (select 1 from sessions s where s.id = session_id and (s.agent_id = auth.uid() or is_admin())));
create policy "read takes" on session_takes for select
  using (exists (select 1 from sessions s where s.id = session_id and (s.agent_id = auth.uid() or is_admin())));
create policy "read answers" on session_answers for select
  using (exists (select 1 from sessions s where s.id = session_id and (s.agent_id = auth.uid() or is_admin())));
create policy "admin reads events" on session_events for select using (is_admin());
create policy "admin reads lifecycle" on recording_lifecycle_events for select using (is_admin());
create policy "admin reads stitch jobs" on stitch_jobs for select using (is_admin());
create policy "admin reads audit" on audit_logs for select using (is_admin());
create policy "admin reads webhooks" on webhook_deliveries for select using (is_admin());

-- ============================================================
-- Storage buckets
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('recordings', 'recordings', false),
  ('question-videos', 'question-videos', true)
on conflict (id) do nothing;

-- Staff can view recordings via signed URLs issued by the API (service role).
-- Question videos are public read; admin uploads via dashboard.
create policy "admin manages question videos" on storage.objects
  for all using (bucket_id = 'question-videos' and is_admin())
  with check (bucket_id = 'question-videos' and is_admin());
create policy "public reads question videos" on storage.objects
  for select using (bucket_id = 'question-videos');
