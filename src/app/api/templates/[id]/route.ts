import { NextResponse } from 'next/server';
import { getStaffUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit } from '@/lib/observability';
import { validateTemplateVariables } from '@/lib/template-validation';

/** GET /api/templates/[id] — single template (any staff) */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = supabaseAdmin();
  const { data, error } = await db.from('templates').select('*').eq('id', params.id).single();
  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ template: data });
}

/**
 * PATCH /api/templates/[id] — edit template in place (admin only).
 * Sessions pin their own template_version + variable_values at creation time
 * (sessions.template_version, sessions.variable_values), so editing here is
 * safe for completed sessions — it only affects new sessions created after
 * the edit. Version is bumped so it's visible which edit a session used.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json();
  if (!body.name || !Array.isArray(body.questions) || body.questions.length === 0) {
    return NextResponse.json({ error: 'name and at least one question required' }, { status: 400 });
  }

  const variables: { key: string; label: string; required: boolean }[] = body.variables ?? [];
  const validationError = validateTemplateVariables(body.questions, body.consent_language ?? '', variables);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const db = supabaseAdmin();
  const { data: before } = await db.from('templates').select('version').eq('id', params.id).single();
  if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data, error } = await db.from('templates').update({
    name: body.name,
    language: body.language ?? 'en-US',
    consent_language: body.consent_language ?? 'This call will be recorded for compliance purposes.',
    webhook_url: body.webhook_url ?? null,
    questions: body.questions,
    variables,
    version: before.version + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', params.id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: 'template.updated', entityType: 'template', entityId: params.id,
    oldValues: { version: before.version }, newValues: { version: data.version },
    actorId: user.id, actorType: 'user',
  });
  return NextResponse.json({ template: data });
}
