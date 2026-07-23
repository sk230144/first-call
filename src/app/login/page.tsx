'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setBusy(false); return; }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="shell narrow">
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <span className="brand-mark" style={{
          width: 44, height: 44, borderRadius: 12, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17,
          color: '#06282c', background: 'linear-gradient(135deg, #22d8ea, #00c2d4)',
          boxShadow: '0 4px 14px rgba(0,194,212,0.35)', marginBottom: 16,
        }}>WC</span>
        <h1 style={{ marginBottom: 4 }}>Welcome Call Platform</h1>
        <p className="muted">Sign in to your staff account</p>
      </div>
      <div className="card">
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="error">{error}</p>}
          <div style={{ marginTop: 20 }}>
            <button className="primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </form>
      </div>
      <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
        Staff access only. Customers join via their one-time call link.
      </p>
    </main>
  );
}
