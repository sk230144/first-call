import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin';
import type { DocumentSessionRow } from './document-types';

/** 64-char cryptographically random hex token — the customer's only credential. */
export function generateDocumentAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export type DocumentTokenAuthResult =
  | { ok: true; session: DocumentSessionRow }
  | { ok: false; status: number; error: string };

/**
 * Validates a customer access token against a document session.
 * Knowing the session ID alone is never enough. No silent failures: 403 on mismatch.
 */
export async function authenticateDocumentSessionToken(
  sessionId: string,
  token: string | null
): Promise<DocumentTokenAuthResult> {
  if (!token) return { ok: false, status: 403, error: 'missing_token' };
  const db = supabaseAdmin();
  const { data: session, error } = await db
    .from('document_sessions').select('*').eq('id', sessionId).single();
  if (error || !session) return { ok: false, status: 404, error: 'session_not_found' };

  // constant-time comparison
  const a = Buffer.from(session.access_token);
  const b = Buffer.from(token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, status: 403, error: 'invalid_token' };
  }
  if (session.status === 'expired' || new Date(session.expires_at) < new Date()) {
    return { ok: false, status: 410, error: 'session_expired' };
  }
  return { ok: true, session: session as DocumentSessionRow };
}

/** Extracts the token from Authorization: Bearer, ?token= or JSON body field. */
export function extractDocumentToken(req: Request, url: URL, body?: any): string | null {
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return url.searchParams.get('token') ?? body?.token ?? null;
}
