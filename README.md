# Welcome Call Platform

Compliance-grade welcome call recording, built to never lose a call. Implements all six phases of the system design: template setup, session creation, live browser call, durable segment upload, server-side assembly, and review/compliance.

## Stack

Next.js 14 (App Router, TypeScript) · Supabase (Postgres, Auth, Storage) · Node + FFmpeg stitch worker.

## Repository layout

```
supabase/migrations/001_init.sql   Full schema: tables, RLS, triggers, storage buckets
src/lib/                           Server libs: token auth, audit/lifecycle logging, webhooks
src/lib/call/                      Client: canvas compositor recorder + IndexedDB upload queue
src/app/api/                       API routes (staff + public token-authed)
src/app/session/[id]/              Customer call page (no login, token in URL)
src/app/dashboard/                 Agent dashboard: create sessions, copy links
src/app/admin/                     Templates builder, review dashboard, recovery queue
public/sw.js                       Background-sync service worker (uploads survive tab close)
worker/                            FFmpeg stitch worker + crons
```

## Setup

### 1. Supabase

1. Create a project at supabase.com.
2. Run `supabase/migrations/001_init.sql` in the SQL editor (or `supabase db push`).
3. Create staff users in Authentication → Users. Every new user gets an `agent` profile automatically; promote admins with:
   ```sql
   update profiles set role = 'admin' where email = 'you@company.com';
   ```

### 2. Web app

```bash
cp .env.example .env.local   # fill in Supabase URL + keys
npm install
npm run dev                  # http://localhost:3000
```

### 3. Stitch worker

Requires `ffmpeg` and `ffprobe` on PATH.

```bash
cd worker
cp ../.env.example .env      # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WEBHOOK_SIGNING_SECRET
npm install
npm start
```

The worker polls `stitch_jobs`, settles deferred sessions (settled-barrier retry), drains the webhook outbox, expires stale sessions, and runs nightly reconciliation at 03:00 UTC.

## End-to-end flow

1. **Admin** creates a template (`/admin/templates`): ordered yes/no questions with optional per-question videos and `{{variable}}` placeholders.
2. **Agent** creates a session (`/dashboard`) — the server generates a 64-char token and one-time link `/session/{id}?token=...` to send by SMS/email.
3. **Customer** opens the link: consent → camera/mic → canvas compositor records webcam + PiP question video + captions burned into the pixels. MediaRecorder emits 30-second segments that are written to IndexedDB and uploaded continuously with retry; a background-sync service worker finishes uploads even if the tab closes. Answers are saved immediately per question.
4. **Completion**: the client reports `expected_segment_count`; the server queues assembly only when all segments are registered (settled barrier), otherwise defers to the worker cron.
5. **Worker** isolates takes (cut & restart preserved in call order), concatenates with FFmpeg, runs the validation gate (size + duration), writes `video_url`, marks the session complete, and fires the HMAC-signed webhook.
6. **Reviewer** (`/admin/review`) watches the video beside timestamped answers and approves or flags. Failed/suspect assemblies land in `/admin/recovery` with one-click re-stitch.

## Design rules honored

Every write is idempotent (deterministic segment paths, upserts, first-consent-wins). No silent failures (typed reasons, lifecycle log, webhook outbox). Server is authoritative (client counts are hints; the barrier decides). Correlation IDs tie client and server events per call. Compliance: overlays are burned in at capture time — the worker never reconstructs or reburns content.

## Notes / stubs

- **Cloud recorder fallback** (Phase 3) is signaled end-to-end (`fallback_requested` events, `recorder_source='cloud'`, skipped by reconciliation) but the actual cloud recording bot is an integration point you must wire to your provider (e.g., a headless recorder joining via the same session link).
- SMS/email delivery of the link is manual (copy button); wire Twilio/SendGrid where the link is returned in `POST /api/sessions`.
- Safari support: `MediaRecorder` mime fallback is included; background sync is unavailable on iOS Safari — the in-page queue with retry still covers refreshes.
