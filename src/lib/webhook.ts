import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin';

/**
 * Webhook dispatch. Writes to an outbox table (webhook_deliveries) so delivery
 * is retried on failure; the stitch worker drains the outbox. Payloads are
 * HMAC-signed for authenticity.
 */
export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function enqueueWebhook(opts: {
  sessionId: string;
  url: string;
  event: 'completed' | 'approved' | 'requires_review';
  payload: Record<string, unknown>;
}) {
  const db = supabaseAdmin();
  await db.from('webhook_deliveries').insert({
    session_id: opts.sessionId,
    url: opts.url,
    event: opts.event,
    payload: opts.payload,
  });
}

/** Attempt one delivery. Returns true on 2xx. Used by the worker's outbox drainer. */
export async function attemptDelivery(delivery: {
  id: string; url: string; event: string; payload: unknown;
}): Promise<{ ok: boolean; error?: string }> {
  const body = JSON.stringify({ event: delivery.event, data: delivery.payload });
  const signature = signPayload(body, process.env.WEBHOOK_SIGNING_SECRET || '');
  try {
    const res = await fetch(delivery.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': delivery.event,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `http_${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'network_error' };
  }
}
