'use client';

/**
 * Recovery queue — sessions whose video failed to assemble or was flagged
 * by nightly reconciliation. Ops resolves each one manually.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';

export default function RecoveryPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/recovery');
    if (r.status === 401 || r.status === 403) { window.location.href = '/login'; return; }
    const d = await r.json();
    setSessions(d.sessions ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(session_id: string, action: 'restitch' | 'resolve' | 'unrecoverable') {
    setBusy(session_id);
    await fetch('/api/admin/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id, action }),
    });
    await load();
    setBusy('');
  }

  return (
    <div className="app-layout">
      <TopBar role="admin" />
      <main className="shell">
        <div className="page-header">
          <div className="eyebrow">Operations</div>
          <h1>Recovery Queue</h1>
          <p className="sub">Reasons: corrupt · too_short · missing · cut_off. A lost recording is a compliance failure — resolve every item.</p>
        </div>
        <div className="card flush">
          <table className="grid" style={{ border: 'none', borderRadius: 0 }}>
            <thead><tr><th>Customer</th><th>Reason</th><th>State</th><th>Source</th><th>Actions</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/admin/review/${s.id}`}><strong>{s.customer_name}</strong></Link></td>
                  <td><span className="pill failed">{s.recovery_reason ?? 'unknown'}</span></td>
                  <td><span className={`pill ${s.recovery_state}`}>{s.recovery_state}</span></td>
                  <td className="muted">{s.recorder_source ?? '—'}</td>
                  <td>
                    <div className="row">
                      <button className="primary" disabled={busy === s.id} onClick={() => act(s.id, 'restitch')}>Re-stitch</button>
                      <button className="good" disabled={busy === s.id} onClick={() => act(s.id, 'resolve')}>Resolved</button>
                      <button className="ghost" disabled={busy === s.id} onClick={() => act(s.id, 'unrecoverable')}>Unrecoverable</button>
                    </div>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state">Recovery queue is empty. 🎉</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
