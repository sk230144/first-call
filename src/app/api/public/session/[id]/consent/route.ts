import { NextResponse } from 'next/server';
import { authenticateSessionToken, extractToken } from '@/lib/session-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit, logLifecycle } from '@/lib/observability';

/**
 * POST /api/public/session/[id]/consent
 * Body: { token, correlation_id, location?, device_info? }
 * Consent event stored with timestamp before recording may start.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const auth = await authenticateSessionToken(params.id, extractToken(req, url, body));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const db = supabaseAdmin();
  const consentAt = new Date().toISOString();
  await db.from('sessions').update({
    consent_at: session.consent_at ?? consentAt, // first consent wins — idempotent
    consent_meta: {
      location: body.location ?? null,       // best-effort
      device_info: body.device_info ?? null,
      user_agent: req.headers.get('user-agent'),
    },
  }).eq('id', session.id);

  await logAudit({
    action: 'session.consent_given', entityType: 'session', entityId: session.id,
    newValues: { consent_at: consentAt }, actorType: 'customer',
  });
  await logLifecycle({
    sessionId: session.id, correlationId: body.correlation_id ?? 'unknown',
    eventType: 'consent.recorded',
  });
  return NextResponse.json({ ok: true, consent_at: session.consent_at ?? consentAt });
}
