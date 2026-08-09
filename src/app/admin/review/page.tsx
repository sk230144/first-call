'use client';

/** Reviewer dashboard — filterable list of sessions for compliance review. */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';

export default function ReviewList() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch('/api/sessions').then(async (r) => {
      if (r.status === 401) { window.location.href = '/login'; return; }
      const d = await r.json();
      setSessions(d.sessions ?? []);
    });
  }

  useEffect(load, []);

  async function deleteSession(id: string, customerName: string) {
    if (!confirm(`Permanently delete the session for "${customerName}"? This removes the recording and all data — this cannot be undone.`)) return;
    setBusyId(id);
    const r = await fetch(`/api/admin/sessions/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(`Failed to delete: ${err.error ?? r.statusText}`);
      setBusyId(null);
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setBusyId(null);
  }

  const filtered = filter === 'all' ? sessions : sessions.filter((s) => s.status === filter);

  return (
    <div className="app-layout">
      <TopBar role="admin" />
      <main className="shell">
        <div className="page-header row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="eyebrow">Compliance</div>
            <h1>Review Queue</h1>
          </div>
          <select style={{ width: 220 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="completed">Completed (needs review)</option>
            <option value="approved">Approved</option>
            <option value="requires_review">Requires review</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div className="card flush">
          <table className="grid" style={{ border: 'none', borderRadius: 0 }}>
            <thead><tr><th>Customer</th><th>Status</th><th>Assembly</th><th>Video</th><th>Completed</th><th></th><th></th></tr></thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.customer_name}</strong></td>
                  <td><span className={`pill ${s.status}`}>{s.status}</span></td>
                  <td><span className={`pill ${s.assembly_status}`}>{s.assembly_status.replace('_', ' ')}</span></td>
                  <td>{s.video_url ? '✅' : '—'}</td>
                  <td className="muted">{s.completed_at ? new Date(s.completed_at).toLocaleString() : '—'}</td>
                  <td><Link href={`/admin/review/${s.id}`}>Open →</Link></td>
                  <td>
                    <button
                      className="danger" disabled={busyId === s.id}
                      onClick={() => deleteSession(s.id, s.customer_name)}
                    >
                      {busyId === s.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state">Nothing to review.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
