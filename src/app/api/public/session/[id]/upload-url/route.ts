import { NextResponse } from 'next/server';
import { authenticateSessionToken, extractToken } from '@/lib/session-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logLifecycle } from '@/lib/observability';

/**
 * POST /api/public/session/[id]/upload-url
 * Body: { token, take_id, segment_index, correlation_id, kind? }
 *
 * Issues a signed upload URL for one segment. The storage path is
 * DETERMINISTIC — retrying the same segment writes to the same place,
 * so uploads are idempotent and no duplicate data accumulates.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const auth = await authenticateSessionToken(params.id, extractToken(req, url, body));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const takeId = String(body.take_id ?? '');
  const segmentIndex = Number(body.segment_index);
  if (!takeId || !Number.isInteger(segmentIndex) || segmentIndex < 0) {
    return NextResponse.json({ error: 'take_id and segment_index required' }, { status: 400 });
  }

  const kind = body.kind === 'snapshot' ? 'snapshot' : 'segment';
  const storagePath = kind === 'snapshot'
    ? `sessions/${session.id}/takes/${takeId}/snapshot-${segmentIndex}.webm`
    : `sessions/${session.id}/takes/${takeId}/seg-${String(segmentIndex).padStart(5, '0')}.webm`;

  const db = supabaseAdmin();
  const { data, error } = await db.storage
    .from('recordings')
    .createSignedUploadUrl(storagePath, { upsert: true }); // safe to retry

  if (error) {
    await logLifecycle({
      sessionId: session.id, correlationId: body.correlation_id ?? 'unknown',
      eventType: 'upload_url.issue_failed', severity: 'error',
      data: { storage_path: storagePath, error: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    upload_url: data.signedUrl,
    storage_token: data.token,
    storage_path: storagePath,
  });
}
