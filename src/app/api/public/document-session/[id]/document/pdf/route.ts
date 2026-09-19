import { NextResponse } from 'next/server';
import { loadAndAuthorizeDocumentSession } from '@/lib/document-session-access';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/public/document-session/[id]/document/pdf?token=...
 *
 * Streams the real, server-rendered PDF (built with pdf-lib at signing
 * time — see /lib/document-pdf.ts) as a direct file download, unlike
 * /document which renders the HTML snapshot inline for on-screen viewing.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const auth = await loadAndAuthorizeDocumentSession(params.id, url);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  if (!session.signed_document_pdf_path) {
    return NextResponse.json({ error: 'pdf_not_available' }, { status: 404 });
  }

  const db = supabaseAdmin();
  const { data: blob, error } = await db.storage
    .from('signed-documents').download(session.signed_document_pdf_path);
  if (error || !blob) return NextResponse.json({ error: 'document_unavailable' }, { status: 404 });

  const bytes = await blob.arrayBuffer();
  const fileName = `${session.customer_name.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'agreement'}-signed.pdf`;
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
