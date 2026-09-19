import { authenticateDocumentSessionToken } from '@/lib/document-session-auth';
import { getStaffUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { DocumentSessionRow } from '@/lib/document-types';

/**
 * Loads a document session and authorizes the caller as either a logged-in
 * staff member (cookie session, checked first — owns it or is admin) or
 * the customer via their one-time ?token= link. Shared by every route that
 * serves the signed document/PDF/video to both audiences.
 */
export async function loadAndAuthorizeDocumentSession(
  sessionId: string,
  url: URL
): Promise<{ ok: true; session: DocumentSessionRow } | { ok: false; status: number; error: string }> {
  const db = supabaseAdmin();
  const { data: session } = await db
    .from('document_sessions').select('*').eq('id', sessionId).single();
  if (!session) return { ok: false, status: 404, error: 'not_found' };

  const staffUser = await getStaffUser();
  if (staffUser) {
    if (staffUser.role !== 'admin' && session.agent_id !== staffUser.id) {
      return { ok: false, status: 403, error: 'forbidden' };
    }
    return { ok: true, session: session as DocumentSessionRow };
  }

  const token = url.searchParams.get('token');
  const auth = await authenticateDocumentSessionToken(sessionId, token);
  if (!auth.ok) return { ok: false, status: auth.status, error: auth.error };
  return { ok: true, session: auth.session };
}
