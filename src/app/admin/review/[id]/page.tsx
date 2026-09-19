'use client';

/**
 * Session review detail: video playback, questions + answers with
 * timestamps side by side, one-click status update.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { useT } from '@/lib/i18n/LocaleProvider';

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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

  async function deleteSession() {
    if (!confirm(t('reviewDetail.confirmDeleteSession'))) return;
    setBusy(true);
    const r = await fetch(`/api/admin/sessions/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(t('review.deleteFailed', { error: err.error ?? r.statusText }));
      setBusy(false);
      return;
    }
    router.push('/admin/review');
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!data) return (
    <div className="app-layout">
      <TopBar role="admin" />
      <main className="shell"><p className="muted">{t('common.loading')}</p></main>
    </div>
  );
  const { session, answers, segments, template, playback_url } = data;
  const questionById: Record<string, any> = {};
  for (const q of template?.questions ?? []) questionById[q.id] = q;
  const customerLink = session.access_token
    ? `${process.env.NEXT_PUBLIC_APP_URL}/session/${session.id}?token=${session.access_token}`
    : null;

  return (
    <div className="app-layout">
      <TopBar role="admin" />
      <main className="shell">
        <div className="page-header row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="eyebrow">{t('reviewDetail.eyebrow')}</div>
            <h1>{session.customer_name}</h1>
          </div>
          <Link href={`/admin/review/${id}/log`}>
            <button className="ghost">{t('reviewDetail.viewFullLog')}</button>
          </Link>
        </div>
        <div className="row" style={{ marginBottom: 20 }}>
          <span className={`pill ${session.status}`}>{session.status}</span>
          <span className={`pill ${session.assembly_status}`}>{t('reviewDetail.assemblyLabel')} {session.assembly_status}</span>
          {session.recovery_state !== 'none' && (
            <span className={`pill ${session.recovery_state}`}>{t('reviewDetail.recoveryLabel')} {session.recovery_state} ({session.recovery_reason ?? '—'})</span>
          )}
          <span className="muted">
            {t('reviewDetail.sourceSegments', {
              source: session.recorder_source ?? '—',
              have: segments?.length ?? 0,
              expected: session.expected_segment_count ?? '?',
            })}
          </span>
        </div>

        {customerLink && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>{t('reviewDetail.customerLink')}</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              {session.status === 'pending' ? t('reviewDetail.notStartedYet') : t('reviewDetail.linkUsed')}
            </p>
            <div className="row">
              <code style={{ flex: 1, wordBreak: 'break-all', fontSize: 13 }}>{customerLink}</code>
              <button className="ghost" onClick={() => copyLink(customerLink)}>{copied ? t('common.copied') : t('common.copyLink')}</button>
            </div>
          </div>
        )}

        {playback_url
          ? <video className="player" controls src={playback_url} />
          : <div className="card"><p className="muted">{t('reviewDetail.videoNotAvailable', { status: session.assembly_status })}</p></div>}

        <div className="row" style={{ margin: '20px 0', justifyContent: 'space-between' }}>
          <div className="row">
            <button className="good" disabled={busy} onClick={() => setStatus('approved')}>{t('reviewDetail.approve')}</button>
            <button className="danger" disabled={busy} onClick={() => setStatus('requires_review')}>{t('reviewDetail.flag')}</button>
          </div>
          <button className="danger" disabled={busy} onClick={deleteSession}>{t('reviewDetail.deleteSession')}</button>
        </div>

        <h2>{t('reviewDetail.answers')}</h2>
        <div className="card flush">
          <table className="grid" style={{ border: 'none', borderRadius: 0 }}>
            <thead><tr><th>#</th><th>{t('reviewDetail.question')}</th><th>{t('reviewDetail.answer')}</th><th>{t('reviewDetail.answeredAt')}</th></tr></thead>
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
                <tr><td colSpan={4}><div className="empty-state">{t('reviewDetail.noAnswers')}</div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <h2>{t('reviewDetail.sessionRecord')}</h2>
        <div className="card" style={{ fontSize: 13 }}>
          <div className="muted" style={{ display: 'grid', gap: 8 }}>
            <div>{t('reviewDetail.sessionId')} <code>{session.id}</code></div>
            <div>{t('reviewDetail.consentAt')} {session.consent_at ? new Date(session.consent_at).toLocaleString() : '—'}</div>
            <div>{t('reviewDetail.started')} {session.started_at ? new Date(session.started_at).toLocaleString() : '—'}</div>
            <div>{t('reviewDetail.completed')} {session.completed_at ? new Date(session.completed_at).toLocaleString() : '—'}</div>
            <div>{t('reviewDetail.variables')} <code>{JSON.stringify(session.variable_values)}</code></div>
          </div>
        </div>
      </main>
    </div>
  );
}
