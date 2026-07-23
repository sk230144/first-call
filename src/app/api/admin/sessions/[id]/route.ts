import { NextResponse } from 'next/server';
import { getStaffUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit } from '@/lib/observability';
import { enqueueWebhook } from '@/lib/webhook';

/** GET /api/admin/sessions/[id] — full session detail for review */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data: session, error } = await db.from('sessions').select('*').eq('id', params.id).single();
  if (error || !session) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (user.role !== 'admin' && session.agent_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const [{ data: answers }, { data: segments }, { data: template }] = await Promise.all([
    db.from('session_answers').select('*').eq('session_id', params.id).order('answered_at'),
    db.from('session_segments').select('*').eq('session_id', params.id).order('segment_index'),
    db.from('templates').select('name, questions').eq('id', session.template_id).single(),
  ]);

  // Signed playback URL for the final video (bucket is private)
  let playbackUrl: string | null = null;
  if (session.video_url) {
    const { data } = await db.storage.from('recordings').createSignedUrl(session.video_url, 3600);
    playbackUrl = data?.signedUrl ?? null;
  }

  return NextResponse.json({ session, answers, segments, template, playback_url: playbackUrl });
}

/**
 * PATCH /api/admin/sessions/[id] — reviewer status update (admin only).
 * Body: { status: 'approved' | 'requires_review' }
 * Fires webhook on both statuses per design.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getStaffUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json();
  if (!['approved', 'requires_review'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be approved or requires_review' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: before } = await db.from('sessions').select('status, template_id, video_url').eq('id', params.id).single();
  if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { error } = await db.from('sessions').update({ status: body.status }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: 'session.status_changed', entityType: 'session', entityId: params.id,
    oldValues: { status: before.status }, newValues: { status: body.status },
    actorId: user.id, actorType: 'user',
  });

  const { data: template } = await db.from('templates').select('webhook_url').eq('id', before.template_id).single();
  if (template?.webhook_url) {
    const { data: answers } = await db.from('session_answers')
      .select('question_id, answer, answered_at').eq('session_id', params.id);
    await enqueueWebhook({
      sessionId: params.id,
      url: template.webhook_url,
      event: body.status,
      payload: { session_id: params.id, video_url: before.video_url, answers },
    });
  }
  return NextResponse.json({ ok: true });
}
