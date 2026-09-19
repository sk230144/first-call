import { NextResponse } from 'next/server';
import { getStaffUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit } from '@/lib/observability';
import { substituteDocumentVariables } from '@/lib/document-types';

/** GET /api/admin/document-sessions/[id] — full session detail for review */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data: session, error } = await db.from('document_sessions').select('*').eq('id', params.id).single();
  if (error || !session) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (user.role !== 'admin' && session.agent_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: template } = await db
    .from('document_templates').select('name, body').eq('id', session.document_template_id).single();

  const filledBody = template ? substituteDocumentVariables(template.body, session.variable_values ?? {}) : '';

  // Served through our own routes (not raw Supabase signed URLs) so the
  // HTML view always renders inline and the PDF always downloads as a
  // real file — see those routes for why. Staff auth there is via the
  // same cookie session, so no token is needed here.
  const documentViewUrl = session.signed_document_path
    ? `/api/public/document-session/${session.id}/document`
    : null;
  const documentUrl = session.signed_document_pdf_path
    ? `/api/public/document-session/${session.id}/document/pdf`
    : null;
  let signatureImageUrl: string | null = null;
  if (session.signature_type === 'drawn' && session.signature_data) {
    const { data } = await db.storage.from('signed-documents').createSignedUrl(session.signature_data, 3600);
    signatureImageUrl = data?.signedUrl ?? null;
  }
  let confirmationVideoUrl: string | null = null;
  if (session.confirmation_video_path) {
    const { data } = await db.storage.from('signed-documents').createSignedUrl(session.confirmation_video_path, 3600);
    confirmationVideoUrl = data?.signedUrl ?? null;
  }

  return NextResponse.json({
    session, template, filled_body: filledBody,
    document_url: documentUrl, document_view_url: documentViewUrl,
    signature_image_url: signatureImageUrl,
    confirmation_video_url: confirmationVideoUrl,
  });
}

/**
 * DELETE /api/admin/document-sessions/[id] — permanently remove a document
 * session (admin only). Removes any Storage objects under
 * document-sessions/{id}/ (signed document + drawn signature), then
 * deletes the row.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getStaffUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const db = supabaseAdmin();
  const { data: before } = await db
    .from('document_sessions').select('id, customer_name, status').eq('id', params.id).single();
  if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const prefix = `document-sessions/${params.id}`;
  const { data: entries } = await db.storage.from('signed-documents').list(prefix, { limit: 1000 });
  if (entries && entries.length > 0) {
    const paths = entries.map((entry) => `${prefix}/${entry.name}`);
    const { error: removeErr } = await db.storage.from('signed-documents').remove(paths);
    if (removeErr) return NextResponse.json({ error: `storage_cleanup_failed: ${removeErr.message}` }, { status: 500 });
  }

  const { error } = await db.from('document_sessions').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: 'document_session.deleted', entityType: 'document_session', entityId: params.id,
    oldValues: before, actorId: user.id, actorType: 'user',
  });
  return NextResponse.json({ ok: true });
}
