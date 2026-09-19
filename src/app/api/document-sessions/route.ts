import { NextResponse } from 'next/server';
import { getStaffUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateDocumentAccessToken } from '@/lib/document-session-auth';
import { logAudit } from '@/lib/observability';

/** GET /api/document-sessions — agent sees own, admin sees all */
export async function GET() {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = supabaseAdmin();
  let q = db.from('document_sessions')
    .select('id, customer_name, status, signed_at, created_at, completed_at, agent_id, document_template_id')
    .order('created_at', { ascending: false }).limit(200);
  if (user.role !== 'admin') q = q.eq('agent_id', user.id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}

/**
 * POST /api/document-sessions — agent creates a document session for a customer.
 * Generates the one-time link: {APP_URL}/document-session/{id}?token={64-hex}
 */
export async function POST(req: Request) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.document_template_id || !body.customer_name) {
    return NextResponse.json({ error: 'document_template_id and customer_name required' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: template, error: tErr } = await db
    .from('document_templates').select('id, version, variables, is_active').eq('id', body.document_template_id).single();
  if (tErr || !template || !template.is_active) {
    return NextResponse.json({ error: 'template_not_found' }, { status: 404 });
  }

  // Unlike video sessions, required variables are NOT enforced here — staff
  // may leave any field blank for the customer to fill in themselves when
  // they open the link. Required fields are enforced later, at sign time
  // (see /api/public/document-session/[id]/sign), where the customer's own
  // input has had a chance to fill the gaps.
  const values: Record<string, string> = body.variable_values ?? {};

  const token = generateDocumentAccessToken();
  const { data: session, error } = await db.from('document_sessions').insert({
    document_template_id: template.id,
    template_version: template.version, // pinned — active sessions use their pinned version
    agent_id: user.id,
    access_token: token,
    customer_name: body.customer_name,
    customer_phone: body.customer_phone ?? null,
    customer_email: body.customer_email ?? null,
    variable_values: values,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: 'document_session.created', entityType: 'document_session', entityId: session.id,
    newValues: { customer_name: session.customer_name, document_template_id: template.id },
    actorId: user.id, actorType: 'user',
  });

  const link = `${process.env.NEXT_PUBLIC_APP_URL}/document-session/${session.id}?token=${token}`;
  return NextResponse.json({ session, link }, { status: 201 });
}
