-- ============================================================
-- Adds a short video-confirmation step after signing: the customer
-- says "I have signed this agreement" on camera as extra proof,
-- stored alongside the signed document snapshot.
-- Run with: supabase db push  (or paste into SQL editor)
-- ============================================================

alter table document_sessions
  add column if not exists confirmation_video_path text; -- storage path in signed-documents bucket
