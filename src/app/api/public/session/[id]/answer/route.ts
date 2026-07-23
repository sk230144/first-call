import { NextResponse } from 'next/server';
import { authenticateSessionToken, extractToken } from '@/lib/session-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit } from '@/lib/observability';

/**
 * POST /api/public/session/[id]/answer
 * Body: { token, question_id, answer: 'yes'|'no', transcript? }
 * Answers are saved IMMEDIATELY as each question is answered — not at the end.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const auth = await authenticateSessionToken(params.id, extractToken(req, url, body));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  if (!body.question_id || !['yes', 'no'].includes(body.answer)) {
    return NextResponse.json({ error: 'question_id and answer (yes|no) required' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from('session_answers').upsert({
    session_id: session.id,
    question_id: String(body.question_id),
    answer: body.answer,
    transcript: body.transcript ?? null,
    answered_at: new Date().toISOString(),
  }, { onConflict: 'session_id,question_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: 'session.answer_recorded', entityType: 'session', entityId: session.id,
    newValues: { question_id: body.question_id, answer: body.answer }, actorType: 'customer',
  });
  return NextResponse.json({ ok: true });
}
