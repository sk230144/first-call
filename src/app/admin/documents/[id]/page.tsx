'use client';

/** Document session review: the filled document, signature, and record details. */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';

export default function DocumentReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/document-sessions/${id}`);
    if (r.status === 401) { window.location.href = '/login'; return; }
    setData(await r.json());
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function deleteSession() {
    if (!confirm('Permanently delete this document session? This removes the signed document and all data — this cannot be undone.')) return;
    setBusy(true);
    const r = await fetch(`/api/admin/document-sessions/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(`Failed to delete: ${err.error ?? r.statusText}`);
      setBusy(false);
      return;
    }
    router.push('/admin/documents');
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!data) return (
    <div className="app-layout">
      <TopBar role="admin" />
      <main className="shell"><p className="muted">Loading…</p></main>
    </div>
  );

  const { session, filled_body, document_url, document_view_url, signature_image_url, confirmation_video_url } = data;
  const customerLink = session.access_token
    ? `${process.env.NEXT_PUBLIC_APP_URL}/document-session/${session.id}?token=${session.access_token}`
    : null;

  return (
    <div className="app-layout">
      <TopBar role="admin" />
      <main className="shell">
        <div className="page-header row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="eyebrow">Document session</div>
            <h1>{session.customer_name}</h1>
          </div>
        </div>
        <div className="row" style={{ marginBottom: 20 }}>
          <span className={`pill ${session.status}`}>{session.status}</span>
          {session.signature_type && <span className="muted">signature: {session.signature_type}</span>}
        </div>

        {customerLink && session.status !== 'completed' && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>Customer link</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              The customer hasn&apos;t signed yet. Share this one-time link with them (SMS or email):
            </p>
            <div className="row">
              <code style={{ flex: 1, wordBreak: 'break-all', fontSize: 13 }}>{customerLink}</code>
              <button className="ghost" onClick={() => copyLink(customerLink)}>{copied ? 'Copied ✓' : 'Copy link'}</button>
            </div>
          </div>
        )}

        <h2>Document</h2>
        <div className="card" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14 }}>
          {filled_body || <span className="muted">No content.</span>}
        </div>

        {session.status === 'completed' && (
          <>
            <h2>Signature</h2>
            <div className="card">
              {session.signature_type === 'typed' && (
                <p style={{ fontFamily: 'cursive', fontSize: 28 }}>{session.signature_data}</p>
              )}
              {session.signature_type === 'drawn' && signature_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signature_image_url} alt="Customer's drawn signature" style={{ maxWidth: 320, background: '#fff', borderRadius: 8 }} />
              )}
              <p className="muted" style={{ marginTop: 12 }}>
                Signed {session.signed_at ? new Date(session.signed_at).toLocaleString() : '—'}
              </p>
              <div className="row" style={{ marginTop: 8 }}>
                {document_view_url && (
                  <a href={document_view_url} target="_blank" rel="noreferrer"><button className="ghost">View document</button></a>
                )}
                {document_url && (
                  <a href={document_url}><button className="primary">Download PDF</button></a>
                )}
              </div>
            </div>

            <h2>Video confirmation</h2>
            <div className="card">
              {confirmation_video_url ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={confirmation_video_url} controls style={{ maxWidth: 360, borderRadius: 8, background: '#000' }} />
              ) : (
                <p className="muted">No confirmation video was recorded for this signature (camera may have been unavailable, or the customer skipped it).</p>
              )}
            </div>
          </>
        )}

        <div className="row" style={{ margin: '20px 0' }}>
          <button className="danger" disabled={busy} onClick={deleteSession}>Delete document session</button>
        </div>

        <h2>Session record</h2>
        <div className="card" style={{ fontSize: 13 }}>
          <div className="muted" style={{ display: 'grid', gap: 8 }}>
            <div>Session ID: <code>{session.id}</code></div>
            <div>Started: {session.started_at ? new Date(session.started_at).toLocaleString() : '—'}</div>
            <div>Completed: {session.completed_at ? new Date(session.completed_at).toLocaleString() : '—'}</div>
            <div>Variables: <code>{JSON.stringify(session.variable_values)}</code></div>
          </div>
        </div>
      </main>
    </div>
  );
}
