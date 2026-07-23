'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

const NAV = [
  { href: '/dashboard', label: 'Sessions', roles: ['admin', 'agent'] },
  { href: '/admin/templates', label: 'Templates', roles: ['admin'] },
  { href: '/admin/review', label: 'Review', roles: ['admin'] },
  { href: '/admin/recovery', label: 'Recovery', roles: ['admin'] },
];

export default function TopBar({ role }: { role: 'admin' | 'agent' }) {
  const router = useRouter();
  const pathname = usePathname();

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">WC</span>
        <span className="brand-text">Welcome Call</span>
      </div>
      <nav>
        {NAV.filter((item) => item.roles.includes(role)).map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="foot">
        <button className="ghost" style={{ width: '100%' }} onClick={signOut}>Sign out</button>
      </div>
    </aside>
  );
}
