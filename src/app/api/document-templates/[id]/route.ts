import { NextResponse } from 'next/server';
import { getStaffUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit } from '@/lib/observability';
import { validateDocumentTemplateVariables } from '@/lib/document-template-validation';

/** GET /api/document-templates/[id] — single document template (any staff) */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = supabaseAdmin();
  const { data, error } = await db.from('document_templates').select('*').eq('id', params.id).single();
  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ template: data });
}

/**
 * PATCH /api/document-templates/[id] — edit in place (admin only).
 * Document sessions pin their own template_version + variable_values at
 * creation time, so editing here only affects sessions created after the
 * save — signed/in-progress sessions are unaffected. Version is bumped so
 * it's visible which edit a given session used.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json();
  if (!body.name || !body.body || typeof body.body !== 'string') {
    return NextResponse.json({ error: 'name and document body required' }, { status: 400 });
  }

  const variables: { key: string; label: string; required: boolean }[] = body.variables ?? [];
  const validationError = validateDocumentTemplateVariables(body.body, variables);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const db = supabaseAdmin();
  const { data: before } = await db.from('document_templates').select('version').eq('id', params.id).single();
  if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data, error } = await db.from('document_templates').update({
    name: body.name,
    body: body.body,
    variables,
    version: before.version + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', params.id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: 'document_template.updated', entityType: 'document_template', entityId: params.id,
    oldValues: { version: before.version }, newValues: { version: data.version },
    actorId: user.id, actorType: 'user',
  });
  return NextResponse.json({ template: data });
}
