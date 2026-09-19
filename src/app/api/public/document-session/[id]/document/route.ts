import { NextResponse } from 'next/server';
import { loadAndAuthorizeDocumentSession } from '@/lib/document-session-access';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/public/document-session/[id]/document?token=...
 *
 * Streams the signed document's on-screen HTML snapshot with an explicit
 * inline Content-Type, served from our own domain rather than a raw
 * Supabase Storage signed URL — Storage's default response for a
 * downloaded object can push the browser to save it as a file instead of
 * rendering it. This route always renders inline; its own "Print / Save
 * as PDF" button is a fallback — the real download is /document/pdf.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const auth = await loadAndAuthorizeDocumentSession(params.id, url);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  if (!session.signed_document_path) {
    return NextResponse.json({ error: 'not_signed_yet' }, { status: 404 });
  }

  const db = supabaseAdmin();
  const { data: blob, error } = await db.storage
    .from('signed-documents').download(session.signed_document_path);
  if (error || !blob) return NextResponse.json({ error: 'document_unavailable' }, { status: 404 });

  const html = await blob.text();
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
}
