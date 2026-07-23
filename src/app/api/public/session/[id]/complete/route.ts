import { NextResponse } from 'next/server';
import { authenticateSessionToken, extractToken } from '@/lib/session-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit, logLifecycle } from '@/lib/observability';

/**
 * POST /api/public/session/[id]/complete
 * Body: { token, expected_segment_count, correlation_id }
 *
 * SETTLED BARRIER: the stitcher does not start until all expected segments
 * have been registered. If counts don't match yet, the session goes to
 * 'awaiting_segments' and the worker's cron retries it — the client's report
 * is a hint, not a ruling. The server is authoritative.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const auth = await authenticateSessionToken(params.id, extractToken(req, url, body));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;
  const correlationId = body.correlation_id ?? 'unknown';

  const expected = Number(body.expected_segment_count);
  if (!Number.isInteger(expected) || expected <= 0) {
    return NextResponse.json({ error: 'expected_segment_count required' }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Idempotent: if already queued/processing/done, report current state
  if (['queued', 'processing', 'done'].includes(session.assembly_status)) {
    return NextResponse.json({ ok: true, assembly_status: session.assembly_status });
  }

  const { count } = await db
    .from('session_segments')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', session.id);
  const registered = count ?? 0;

  await logLifecycle({
    sessionId: session.id, correlationId, eventType: 'complete.requested',
    data: { expected_segment_count: expected, registered_segment_count: registered },
  });

  if (registered >= expected) {
    // Barrier satisfied — queue assembly
    await db.from('sessions').update({
      expected_segment_count: expected,
      assembly_status: 'queued',
      recorder_source: body.recorder_source ?? 'browser',
    }).eq('id', session.id);
    await db.from('stitch_jobs').insert({ session_id: session.id });
    await logLifecycle({
      sessionId: session.id, correlationId, eventType: 'stitch.queued',
      data: { registered_segment_count: registered },
    });
    await logAudit({
      action: 'session.assembly_queued', entityType: 'session', entityId: session.id,
      newValues: { expected, registered }, actorType: 'customer',
    });
    return NextResponse.json({ ok: true, assembly_status: 'queued' });
  }

  // Deferred — worker cron re-checks the barrier and queues when settled
  await db.from('sessions').update({
    expected_segment_count: expected,
    assembly_status: 'awaiting_segments',
    recorder_source: body.recorder_source ?? 'browser',
  }).eq('id', session.id);
  await logLifecycle({
    sessionId: session.id, correlationId, eventType: 'complete.deferred', severity: 'warn',
    data: { expected, registered, missing: expected - registered },
  });
  return NextResponse.json({ ok: true, assembly_status: 'awaiting_segments', registered, expected });
}
