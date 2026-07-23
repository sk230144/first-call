import { NextResponse } from 'next/server';
import { getStaffUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateAccessToken } from '@/lib/session-auth';
import { logAudit } from '@/lib/observability';

/** GET /api/sessions — agent sees own, admin sees all */
export async function GET() {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = supabaseAdmin();
  let q = db.from('sessions')
    .select('id, customer_name, status, assembly_status, recovery_state, video_url, created_at, completed_at, agent_id, template_id')
    .order('created_at', { ascending: false }).limit(200);
  if (user.role !== 'admin') q = q.eq('agent_id', user.id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}

/**
 * POST /api/sessions — agent creates a session for a customer.
 * Generates the one-time link: {APP_URL}/session/{id}?token={64-hex}
 */
export async function POST(req: Request) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.template_id || !body.customer_name) {
    return NextResponse.json({ error: 'template_id and customer_name required' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: template, error: tErr } = await db
    .from('templates').select('id, version, variables, is_active').eq('id', body.template_id).single();
  if (tErr || !template || !template.is_active) {
    return NextResponse.json({ error: 'template_not_found' }, { status: 404 });
  }

  // Validate required variables are provided
  const values: Record<string, string> = body.variable_values ?? {};
  const missing = (template.variables as any[])
    .filter((v) => v.required && !values[v.key])
    .map((v) => v.key);
  if (missing.length > 0) {
    return NextResponse.json({ error: `missing required variables: ${missing.join(', ')}` }, { status: 400 });
  }

  const token = generateAccessToken();
  const { data: session, error } = await db.from('sessions').insert({
    template_id: template.id,
    template_version: template.version, // pinned — active sessions use their pinned version
    agent_id: user.id,
    access_token: token,
    customer_name: body.customer_name,
    customer_phone: body.customer_phone ?? null,
    customer_email: body.customer_email ?? null,
    customer_address: body.customer_address ?? null,
    variable_values: values,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: 'session.created', entityType: 'session', entityId: session.id,
    newValues: { customer_name: session.customer_name, template_id: template.id },
    actorId: user.id, actorType: 'user',
  });

  const link = `${process.env.NEXT_PUBLIC_APP_URL}/session/${session.id}?token=${token}`;
  return NextResponse.json({ session, link }, { status: 201 });
}
