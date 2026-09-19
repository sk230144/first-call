import { NextResponse } from 'next/server';
import { authenticateDocumentSessionToken, extractDocumentToken } from '@/lib/document-session-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logDocumentLifecycle } from '@/lib/observability';

/**
 * POST /api/public/document-session/[id]/confirmation-video
 * Body: { token, correlation_id, storage_path }
 * Registers the already-uploaded "I have signed this agreement" clip
 * against a session that has already been signed (status completed).
 * A missing/failed video never blocks signing — this is best-effort
 * extra proof, called after /sign has already succeeded.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const auth = await authenticateDocumentSessionToken(params.id, extractDocumentToken(req, url, body));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const storagePath = String(body.storage_path ?? '');
  if (!storagePath) return NextResponse.json({ error: 'storage_path required' }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from('document_sessions')
    .update({ confirmation_video_path: storagePath }).eq('id', session.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logDocumentLifecycle({
    documentSessionId: session.id, correlationId: body.correlation_id ?? 'unknown',
    eventType: 'document.confirmation_video_registered', data: { storage_path: storagePath },
  });
  return NextResponse.json({ ok: true });
}
