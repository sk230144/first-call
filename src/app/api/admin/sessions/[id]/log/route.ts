import { NextResponse } from 'next/server';
import { getStaffUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/admin/sessions/[id]/log — full timeline for a session.
 * Merges the client/server lifecycle event stream with the immutable audit
 * trail (status/recovery changes) into one chronological feed.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data: session, error } = await db.from('sessions').select('id, agent_id, customer_name').eq('id', params.id).single();
  if (error || !session) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (user.role !== 'admin' && session.agent_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const [{ data: lifecycle }, { data: audit }, { data: events }] = await Promise.all([
    db.from('recording_lifecycle_events').select('*').eq('session_id', params.id).order('created_at'),
    db.from('audit_logs').select('*').eq('entity_type', 'session').eq('entity_id', params.id).order('created_at'),
    db.from('session_events').select('*').eq('session_id', params.id).order('created_at'),
  ]);

  const timeline = [
    ...(lifecycle ?? []).map((e) => ({
      source: 'lifecycle' as const,
      at: e.created_at,
      correlation_id: e.correlation_id,
      severity: e.severity,
      label: e.event_type,
      data: e.data,
    })),
    ...(audit ?? []).map((e) => ({
      source: 'audit' as const,
      at: e.created_at,
      correlation_id: null,
      severity: 'info' as const,
      label: e.action,
      data: { old_values: e.old_values, new_values: e.new_values, actor_type: e.actor_type, actor_id: e.actor_id },
    })),
    ...(events ?? []).map((e) => ({
      source: 'client' as const,
      at: e.created_at,
      correlation_id: e.event_data?.correlation_id ?? null,
      severity: 'info' as const,
      label: e.event_type,
      data: e.event_data,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return NextResponse.json({ session, timeline });
}
