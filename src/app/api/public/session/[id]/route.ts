import { NextResponse } from 'next/server';
import { authenticateSessionToken, extractToken } from '@/lib/session-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { substituteVariables } from '@/lib/types';
import { logLifecycle } from '@/lib/observability';

/**
 * GET /api/public/session/[id]?token=...
 * Customer-facing call payload: consent language + questions with variables
 * substituted, using the template version pinned at session creation.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const auth = await authenticateSessionToken(params.id, extractToken(req, url));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  if (session.status === 'completed' || session.status === 'approved') {
    return NextResponse.json({ error: 'already_completed' }, { status: 409 });
  }

  const db = supabaseAdmin();
  const { data: template } = await db
    .from('templates')
    .select('language, recording_mode, consent_language, questions')
    .eq('id', session.template_id).single();
  if (!template) return NextResponse.json({ error: 'template_not_found' }, { status: 404 });

  const questions = (template.questions as any[])
    .sort((a, b) => a.order - b.order)
    .map((q) => ({
      id: q.id,
      order: q.order,
      text: substituteVariables(q.text, session.variable_values),
      video_url: q.video_url ?? null,
    }));

  // Answers already saved (resume after refresh / cut & restart)
  const { data: answers } = await db
    .from('session_answers').select('question_id, answer').eq('session_id', session.id);

  return NextResponse.json({
    session: {
      id: session.id,
      status: session.status,
      customer_name: session.customer_name,
      consent_at: session.consent_at,
    },
    template: {
      language: template.language,
      recording_mode: template.recording_mode,
      consent_language: template.consent_language,
    },
    questions,
    answered: answers ?? [],
  });
}

/**
 * POST /api/public/session/[id] — mark session active (call started).
 * Body: { token, correlation_id }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const auth = await authenticateSessionToken(params.id, extractToken(req, url, body));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const db = supabaseAdmin();
  if (session.status === 'pending') {
    await db.from('sessions')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', session.id).eq('status', 'pending'); // idempotent
  }
  await logLifecycle({
    sessionId: session.id,
    correlationId: body.correlation_id ?? 'unknown',
    eventType: 'call.started',
    data: { user_agent: req.headers.get('user-agent') },
  });
  return NextResponse.json({ ok: true });
}
