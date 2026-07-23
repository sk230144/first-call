import { NextResponse } from 'next/server';
import { getStaffUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit } from '@/lib/observability';

/** GET /api/templates — list active templates (any staff) */
export async function GET() {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('templates').select('*').eq('is_active', true).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
}

/** POST /api/templates — create template (admin only) */
export async function POST(req: Request) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json();
  if (!body.name || !Array.isArray(body.questions) || body.questions.length === 0) {
    return NextResponse.json({ error: 'name and at least one question required' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db.from('templates').insert({
    name: body.name,
    language: body.language ?? 'en-US',
    recording_mode: body.recording_mode ?? 'browser',
    consent_language: body.consent_language ?? 'This call will be recorded for compliance purposes.',
    webhook_url: body.webhook_url ?? null,
    questions: body.questions,
    variables: body.variables ?? [],
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: 'template.created', entityType: 'template', entityId: data.id,
    newValues: { name: data.name, version: data.version }, actorId: user.id, actorType: 'user',
  });
  return NextResponse.json({ template: data }, { status: 201 });
}
