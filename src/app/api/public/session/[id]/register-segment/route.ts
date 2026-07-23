import { NextResponse } from 'next/server';
import { authenticateSessionToken, extractToken } from '@/lib/session-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logLifecycle } from '@/lib/observability';

/**
 * POST /api/public/session/[id]/register-segment
 * Body: { token, take_id, segment_index, storage_path, size_bytes, duration_ms, correlation_id }
 *
 * Registers an uploaded segment server-side. Upsert on
 * (session_id, take_id, segment_index) makes registration idempotent.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const auth = await authenticateSessionToken(params.id, extractToken(req, url, body));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const takeId = String(body.take_id ?? '');
  const segmentIndex = Number(body.segment_index);
  if (!takeId || !Number.isInteger(segmentIndex) || !body.storage_path) {
    return NextResponse.json({ error: 'take_id, segment_index, storage_path required' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from('session_segments').upsert({
    session_id: session.id,
    take_id: takeId,
    segment_index: segmentIndex,
    storage_path: body.storage_path,
    size_bytes: body.size_bytes ?? null,
    duration_ms: body.duration_ms ?? null,
    mime_type: body.mime_type ?? 'video/webm',
  }, { onConflict: 'session_id,take_id,segment_index' });

  const correlationId = body.correlation_id ?? 'unknown';
  if (error) {
    await logLifecycle({
      sessionId: session.id, correlationId, eventType: 'segment.register_failed',
      severity: 'error', data: { take_id: takeId, segment_index: segmentIndex, error: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logLifecycle({
    sessionId: session.id, correlationId, eventType: 'segment.registered',
    data: { take_id: takeId, segment_index: segmentIndex, size_bytes: body.size_bytes },
  });
  return NextResponse.json({ ok: true });
}
