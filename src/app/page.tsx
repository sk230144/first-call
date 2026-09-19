import { redirect } from 'next/navigation';
import { getStaffUser } from '@/lib/supabase-server';
import LandingContent from './LandingContent';

/**
 * Public marketing landing page.
 * Signed-in staff skip straight to their dashboard; everyone else sees this.
 * Kept as a server component so getStaffUser() runs server-side; the actual
 * markup lives in LandingContent (client) so it can read the UI locale.
 */
export default async function Home() {
  const user = await getStaffUser();
  if (user) redirect('/dashboard');

  return <LandingContent />;
}
