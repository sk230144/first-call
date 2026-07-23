import { NextResponse } from 'next/server';
import { authenticateSessionToken, extractToken } from '@/lib/session-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/public/session/[id]/event
 * Body: { token, event_type, event_data }
 * Client-side telemetry: compositor health, upload outcomes, recorder errors.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const auth = await authenticateSessionToken(params.id, extractToken(req, url, body));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!body.event_type) {
    return NextResponse.json({ error: 'event_type required' }, { status: 400 });
  }

  const db = supabaseAdmin();
  await db.from('session_events').insert({
    session_id: auth.session.id,
    event_type: String(body.event_type),
    event_data: body.event_data ?? {},
  });
  return NextResponse.json({ ok: true });
}
