'use client';

/**
 * Recovery queue — sessions whose video failed to assemble or was flagged
 * by nightly reconciliation. Ops resolves each one manually.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { useT } from '@/lib/i18n/LocaleProvider';

export default function RecoveryPage() {
  const t = useT();
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
          <div className="eyebrow">{t('recovery.eyebrow')}</div>
          <h1>{t('recovery.title')}</h1>
          <p className="sub">{t('recovery.subtitle')}</p>
        </div>
        <div className="card flush">
          <table className="grid" style={{ border: 'none', borderRadius: 0 }}>
            <thead><tr><th>{t('recovery.customer')}</th><th>{t('recovery.reason')}</th><th>{t('recovery.state')}</th><th>{t('recovery.source')}</th><th>{t('recovery.actions')}</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/admin/review/${s.id}`}><strong>{s.customer_name}</strong></Link></td>
                  <td><span className="pill failed">{s.recovery_reason ?? 'unknown'}</span></td>
                  <td><span className={`pill ${s.recovery_state}`}>{s.recovery_state}</span></td>
                  <td className="muted">{s.recorder_source ?? '—'}</td>
                  <td>
                    <div className="row">
                      <button className="primary" disabled={busy === s.id} onClick={() => act(s.id, 'restitch')}>{t('recovery.restitch')}</button>
                      <button className="good" disabled={busy === s.id} onClick={() => act(s.id, 'resolve')}>{t('recovery.resolved')}</button>
                      <button className="ghost" disabled={busy === s.id} onClick={() => act(s.id, 'unrecoverable')}>{t('recovery.unrecoverable')}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state">{t('recovery.empty')}</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
