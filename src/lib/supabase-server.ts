import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Cookie-based client for reading the logged-in staff user in route handlers / RSC. */
export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — safe to ignore
          }
        },
      },
    }
  );
}

export type StaffUser = { id: string; email: string; role: 'admin' | 'agent' };

/** Returns the logged-in staff user with role, or null. */
export async function getStaffUser(): Promise<StaffUser | null> {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('role, email').eq('id', user.id).single();
  if (!profile) return null;
  return { id: user.id, email: profile.email, role: profile.role };
}
