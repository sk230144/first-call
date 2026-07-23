import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. Server-side only. Bypasses RLS — every route that
 * uses it MUST validate either a staff session or a customer access token.
 */
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
