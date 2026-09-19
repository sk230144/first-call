import { supabaseAdmin } from './supabase-admin';

/**
 * Server-side structured lifecycle log. Every event carries a correlation ID
 * so client and server events for the same call can always be tied together.
 * No silent failures: callers pass a typed event and reason.
 */
export async function logLifecycle(opts: {
  sessionId: string | null;
  correlationId: string;
  eventType: string;
  severity?: 'info' | 'warn' | 'error';
  data?: Record<string, unknown>;
}) {
  const db = supabaseAdmin();
  const { error } = await db.from('recording_lifecycle_events').insert({
    session_id: opts.sessionId,
    correlation_id: opts.correlationId,
    event_type: opts.eventType,
    severity: opts.severity ?? 'info',
    data: opts.data ?? {},
  });
  if (error) console.error('[lifecycle] failed to log', opts.eventType, error.message);
}

/**
 * Same shape as logLifecycle, but for the document-signing flow — a
 * separate table (document_lifecycle_events) because that flow's rows
 * key off document_sessions, not sessions.
 */
export async function logDocumentLifecycle(opts: {
  documentSessionId: string | null;
  correlationId: string;
  eventType: string;
  severity?: 'info' | 'warn' | 'error';
  data?: Record<string, unknown>;
}) {
  const db = supabaseAdmin();
  const { error } = await db.from('document_lifecycle_events').insert({
    document_session_id: opts.documentSessionId,
    correlation_id: opts.correlationId,
    event_type: opts.eventType,
    severity: opts.severity ?? 'info',
    data: opts.data ?? {},
  });
  if (error) console.error('[doc-lifecycle] failed to log', opts.eventType, error.message);
}

/** Immutable audit trail on every state change. */
export async function logAudit(opts: {
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  actorId?: string | null;
  actorType?: 'user' | 'system' | 'customer';
}) {
  const db = supabaseAdmin();
  const { error } = await db.from('audit_logs').insert({
    action: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId,
    old_values: opts.oldValues ?? null,
    new_values: opts.newValues ?? null,
    actor_id: opts.actorId ?? null,
    actor_type: opts.actorType ?? 'system',
  });
  if (error) console.error('[audit] failed to log', opts.action, error.message);
}
