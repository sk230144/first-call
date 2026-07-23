import { redirect } from 'next/navigation';
import { getStaffUser } from '@/lib/supabase-server';

export default async function Home() {
  const user = await getStaffUser();
  redirect(user ? '/dashboard' : '/login');
}
