'use client';

import { useEffect, useState } from 'react';
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
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes, so tapping a link
  // doesn't leave it covering the page it just navigated to.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* Mobile-only bar with the hamburger; hidden at desktop widths. */}
      <header className="mobile-bar">
        <button
          className="hamburger"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpen(true)}
        >
          <span /><span /><span />
        </button>
        <div className="brand">
          <span className="brand-mark">WC</span>
          <span className="brand-text">Welcome Call</span>
        </div>
      </header>

      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside id="app-sidebar" className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-mark">WC</span>
            <span className="brand-text">Welcome Call</span>
          </div>
          <button className="sidebar-close" aria-label="Close menu" onClick={() => setOpen(false)}>✕</button>
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
    </>
  );
}
