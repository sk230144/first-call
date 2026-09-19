import { NextResponse } from 'next/server';
import { getStaffUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit } from '@/lib/observability';
import { validateDocumentTemplateVariables } from '@/lib/document-template-validation';

/** GET /api/document-templates — list active document templates (any staff) */
export async function GET() {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('document_templates').select('*').eq('is_active', true).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
}

/** POST /api/document-templates — create a document template (admin only) */
export async function POST(req: Request) {
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
  const { data, error } = await db.from('document_templates').insert({
    name: body.name,
    body: body.body,
    variables,
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: 'document_template.created', entityType: 'document_template', entityId: data.id,
    newValues: { name: data.name, version: data.version }, actorId: user.id, actorType: 'user',
  });
  return NextResponse.json({ template: data }, { status: 201 });
}
