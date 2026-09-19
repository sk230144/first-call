-- ============================================================
-- Adds a real, directly-downloadable PDF alongside the existing HTML
-- snapshot of the signed document (rendered server-side with pdf-lib,
-- no headless browser). Run with: supabase db push (or paste into SQL editor)
-- ============================================================

alter table document_sessions
  add column if not exists signed_document_pdf_path text; -- storage path in signed-documents bucket
