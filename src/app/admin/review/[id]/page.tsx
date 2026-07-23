'use client';

/**
 * Session review detail: video playback, questions + answers with
 * timestamps side by side, one-click status update.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/sessions/${id}`);
    if (r.status === 401) { window.location.href = '/login'; return; }
    setData(await r.json());
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function setStatus(status: 'approved' | 'requires_review') {
    setBusy(true);
    await fetch(`/api/admin/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
    setBusy(false);
  }

  if (!data) return (
    <div className="app-layout">
      <TopBar role="admin" />
      <main className="shell"><p className="muted">Loading…</p></main>
    </div>
  );
  const { session, answers, segments, template, playback_url } = data;
  const questionById: Record<string, any> = {};
  for (const q of template?.questions ?? []) questionById[q.id] = q;

  return (
    <div className="app-layout">
      <TopBar role="admin" />
      <main className="shell">
        <div className="page-header row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="eyebrow">Session</div>
            <h1>{session.customer_name}</h1>
          </div>
          <Link href={`/admin/review/${id}/log`}>
            <button className="ghost">View full log →</button>
          </Link>
        </div>
        <div className="row" style={{ marginBottom: 20 }}>
          <span className={`pill ${session.status}`}>{session.status}</span>
          <span className={`pill ${session.assembly_status}`}>assembly: {session.assembly_status}</span>
          {session.recovery_state !== 'none' && (
            <span className={`pill ${session.recovery_state}`}>recovery: {session.recovery_state} ({session.recovery_reason ?? '—'})</span>
          )}
          <span className="muted">source: {session.recorder_source ?? '—'} · segments: {segments?.length ?? 0} / {session.expected_segment_count ?? '?'}</span>
        </div>

        {playback_url
          ? <video className="player" controls src={playback_url} />
          : <div className="card"><p className="muted">Final video not available yet (assembly: {session.assembly_status}).</p></div>}

        <div className="row" style={{ margin: '20px 0' }}>
          <button className="good" disabled={busy} onClick={() => setStatus('approved')}>Approve</button>
          <button className="danger" disabled={busy} onClick={() => setStatus('requires_review')}>Flag — requires review</button>
        </div>

        <h2>Answers</h2>
        <div className="card flush">
          <table className="grid" style={{ border: 'none', borderRadius: 0 }}>
            <thead><tr><th>#</th><th>Question</th><th>Answer</th><th>Answered at</th></tr></thead>
            <tbody>
              {(answers ?? []).map((a: any, i: number) => (
                <tr key={a.id}>
                  <td>{i + 1}</td>
                  <td>{questionById[a.question_id]?.text ?? a.question_id}</td>
                  <td><span className={`pill ${a.answer === 'yes' ? 'approved' : 'failed'}`}>{a.answer}</span></td>
                  <td className="muted">{new Date(a.answered_at).toLocaleString()}</td>
                </tr>
              ))}
              {(answers ?? []).length === 0 && (
                <tr><td colSpan={4}><div className="empty-state">No answers recorded.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <h2>Session record</h2>
        <div className="card" style={{ fontSize: 13 }}>
          <div className="muted" style={{ display: 'grid', gap: 8 }}>
            <div>Session ID: <code>{session.id}</code></div>
            <div>Consent at: {session.consent_at ? new Date(session.consent_at).toLocaleString() : '—'}</div>
            <div>Started: {session.started_at ? new Date(session.started_at).toLocaleString() : '—'}</div>
            <div>Completed: {session.completed_at ? new Date(session.completed_at).toLocaleString() : '—'}</div>
            <div>Variables: <code>{JSON.stringify(session.variable_values)}</code></div>
          </div>
        </div>
      </main>
    </div>
  );
}
