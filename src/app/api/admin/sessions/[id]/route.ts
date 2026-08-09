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

/**
 * DELETE /api/admin/sessions/[id] — permanently remove a session (admin only).
 * Removes all Storage objects under sessions/{id}/ (segments + final video),
 * then deletes the sessions row. Every FK table (session_segments,
 * session_takes, session_answers, session_events, stitch_jobs,
 * webhook_deliveries) cascades via ON DELETE CASCADE; recording_lifecycle_events
 * sets session_id to NULL; audit_logs is untouched (immutable, no FK).
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getStaffUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const db = supabaseAdmin();
  const { data: before } = await db.from('sessions').select('id, customer_name, status').eq('id', params.id).single();
  if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const prefix = `sessions/${params.id}`;
  const objects = await listAllStorageObjects(db, 'recordings', prefix);
  if (objects.length > 0) {
    const { error: removeErr } = await db.storage.from('recordings').remove(objects);
    if (removeErr) return NextResponse.json({ error: `storage_cleanup_failed: ${removeErr.message}` }, { status: 500 });
  }

  const { error } = await db.from('sessions').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: 'session.deleted', entityType: 'session', entityId: params.id,
    oldValues: before, actorId: user.id, actorType: 'user',
  });
  return NextResponse.json({ ok: true });
}

/** Recursively lists every object under a Storage prefix (folders need per-level listing). */
async function listAllStorageObjects(
  db: ReturnType<typeof supabaseAdmin>, bucket: string, prefix: string
): Promise<string[]> {
  const { data: entries, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !entries) return [];
  const paths: string[] = [];
  for (const entry of entries) {
    const fullPath = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      // No file id means this entry is a folder — recurse into it.
      paths.push(...await listAllStorageObjects(db, bucket, fullPath));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}
