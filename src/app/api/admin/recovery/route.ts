import { NextResponse } from 'next/server';
import { getStaffUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit, logLifecycle } from '@/lib/observability';
import crypto from 'crypto';

/** GET /api/admin/recovery — the recovery queue (admin only) */
export async function GET() {
  const user = await getStaffUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const db = supabaseAdmin();
  const { data, error } = await db.from('sessions')
    .select('id, customer_name, status, assembly_status, recovery_state, recovery_reason, recorder_source, created_at')
    .in('recovery_state', ['flagged', 'in_recovery'])
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}

/**
 * POST /api/admin/recovery — act on a flagged session (admin only).
 * Body: { session_id, action: 'restitch' | 'resolve' | 'unrecoverable' }
 * 'restitch' queues a new stitch job (manual recovery trigger).
 */
export async function POST(req: Request) {
  const user = await getStaffUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json();
  const { session_id, action } = body;
  if (!session_id || !['restitch', 'resolve', 'unrecoverable'].includes(action)) {
    return NextResponse.json({ error: 'session_id and valid action required' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const correlationId = crypto.randomUUID();

  if (action === 'restitch') {
    await db.from('sessions').update({
      recovery_state: 'in_recovery', assembly_status: 'queued',
    }).eq('id', session_id);
    await db.from('stitch_jobs').insert({ session_id });
    await logLifecycle({
      sessionId: session_id, correlationId, eventType: 'recovery.restitch_triggered',
      data: { triggered_by: user.id },
    });
  } else {
    await db.from('sessions').update({
      recovery_state: action === 'resolve' ? 'resolved' : 'unrecoverable',
    }).eq('id', session_id);
    await logLifecycle({
      sessionId: session_id, correlationId,
      eventType: `recovery.marked_${action === 'resolve' ? 'resolved' : 'unrecoverable'}`,
      severity: action === 'resolve' ? 'info' : 'warn',
      data: { by: user.id },
    });
  }

  await logAudit({
    action: `recovery.${action}`, entityType: 'session', entityId: session_id,
    actorId: user.id, actorType: 'user',
  });
  return NextResponse.json({ ok: true });
}
