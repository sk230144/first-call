import { NextResponse } from 'next/server';
import { authenticateDocumentSessionToken, extractDocumentToken } from '@/lib/document-session-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logDocumentLifecycle } from '@/lib/observability';

/**
 * GET /api/public/document-session/[id]?token=...
 * Customer-facing payload: the raw document body (with {{variables}}
 * unsubstituted) plus the variable definitions and any values already
 * saved (resume after refresh). Substitution happens client-side so the
 * preview updates live as the customer types, before anything is saved.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const auth = await authenticateDocumentSessionToken(params.id, extractDocumentToken(req, url));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  if (session.status === 'completed') {
    return NextResponse.json({ error: 'already_completed' }, { status: 409 });
  }

  const db = supabaseAdmin();
  const { data: template } = await db
    .from('document_templates').select('name, body, variables').eq('id', session.document_template_id).single();
  if (!template) return NextResponse.json({ error: 'template_not_found' }, { status: 404 });

  return NextResponse.json({
    session: {
      id: session.id,
      status: session.status,
      customer_name: session.customer_name,
      signed_at: session.signed_at,
    },
    template: {
      name: template.name,
      body: template.body,
      variables: template.variables,
    },
    variable_values: session.variable_values ?? {},
  });
}

/**
 * POST /api/public/document-session/[id] — mark session active, or
 * autosave in-progress variable values.
 * Body: { token, correlation_id, variable_values? }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const auth = await authenticateDocumentSessionToken(params.id, extractDocumentToken(req, url, body));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;
  if (session.status === 'completed') {
    return NextResponse.json({ error: 'already_completed' }, { status: 409 });
  }

  const db = supabaseAdmin();
  const updates: Record<string, unknown> = {};
  if (session.status === 'pending') {
    updates.status = 'active';
    updates.started_at = new Date().toISOString();
  }
  if (body.variable_values && typeof body.variable_values === 'object') {
    updates.variable_values = { ...session.variable_values, ...body.variable_values };
  }
  if (Object.keys(updates).length > 0) {
    await db.from('document_sessions').update(updates).eq('id', session.id);
  }

  await logDocumentLifecycle({
    documentSessionId: session.id,
    correlationId: body.correlation_id ?? 'unknown',
    eventType: 'document.progress_saved',
    data: { fields_updated: body.variable_values ? Object.keys(body.variable_values) : [] },
  });
  return NextResponse.json({ ok: true });
}
