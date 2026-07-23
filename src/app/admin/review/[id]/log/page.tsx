'use client';

/**
 * Full session timeline: every lifecycle event (server), client telemetry
 * event, and audit-log state change, merged and sorted chronologically.
 * The single place to answer "what happened during this call?".
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';

type Entry = {
  source: 'lifecycle' | 'audit' | 'client';
  at: string;
  correlation_id: string | null;
  severity: 'info' | 'warn' | 'error';
  label: string;
  data: Record<string, unknown> | null;
};

export default function SessionLogPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<{ id: string; customer_name: string } | null>(null);
  const [timeline, setTimeline] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'lifecycle' | 'audit' | 'client'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/sessions/${id}/log`);
    if (r.status === 401) { window.location.href = '/login'; return; }
    const d = await r.json();
    setSession(d.session ?? null);
    setTimeline(d.timeline ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const filtered = timeline
    .filter((e) => filter === 'all' || e.source === filter)
    .filter((e) => severityFilter === 'all' || e.severity === severityFilter);

  return (
    <div className="app-layout">
      <TopBar role="admin" />
      <main className="shell">
        <div className="page-header">
          <div className="eyebrow">
            <Link href={`/admin/review/${id}`}>← Back to session</Link>
          </div>
          <h1>{session ? `${session.customer_name} — Full log` : 'Session log'}</h1>
          <p className="sub">Every recorded event for this session, in order — client telemetry, server lifecycle events, and audit-trail state changes.</p>
        </div>

        <div className="row" style={{ marginBottom: 20 }}>
          <select style={{ width: 200 }} value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">All sources</option>
            <option value="lifecycle">Server lifecycle</option>
            <option value="client">Client telemetry</option>
            <option value="audit">Audit trail</option>
          </select>
          <select style={{ width: 160 }} value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as any)}>
            <option value="all">All severities</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <span className="muted">{filtered.length} of {timeline.length} events</span>
        </div>

        {loading && <p className="muted">Loading…</p>}

        {!loading && (
          <div className="card flush">
            <div className="log-list">
              {filtered.map((e, i) => <LogRow key={i} entry={e} />)}
              {filtered.length === 0 && <div className="empty-state">No events match this filter.</div>}
            </div>
          </div>
        )}

        <style>{`
          .log-list { display: flex; flex-direction: column; }
          .log-row {
            display: grid; grid-template-columns: 168px 90px 1fr; gap: 16px;
            padding: 12px 20px; border-top: 1px solid var(--border-soft);
            font-size: 13px; align-items: start;
          }
          .log-row:first-child { border-top: none; }
          .log-row:hover { background: var(--surface-hover); }
          .log-time { color: var(--text3); font-variant-numeric: tabular-nums; white-space: nowrap; }
          .log-label { font-weight: 600; color: var(--text); word-break: break-word; }
          .log-source { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text3); margin-top: 2px; }
          .log-data {
            margin-top: 6px; font-size: 12px; color: var(--text2);
            background: var(--surface2); border: 1px solid var(--border-soft); border-radius: 6px;
            padding: 8px 10px; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, monospace;
          }
          .log-corr { color: var(--text3); font-size: 11px; margin-top: 4px; }
        `}</style>
      </main>
    </div>
  );
}

function LogRow({ entry }: { entry: Entry }) {
  const hasData = entry.data && Object.values(entry.data).some((v) => v !== null && v !== undefined);
  return (
    <div className="log-row">
      <div className="log-time">{new Date(entry.at).toLocaleString()}</div>
      <div>
        <span className={`pill ${severityPill(entry.severity)}`}>{entry.severity}</span>
      </div>
      <div>
        <div className="log-label">{entry.label}</div>
        <div className="log-source">{sourceLabel(entry.source)}</div>
        {entry.correlation_id && <div className="log-corr">correlation: {entry.correlation_id}</div>}
        {hasData && <div className="log-data">{JSON.stringify(entry.data, null, 2)}</div>}
      </div>
    </div>
  );
}

function severityPill(s: string) {
  if (s === 'error') return 'failed';
  if (s === 'warn') return 'flagged';
  return 'completed';
}

function sourceLabel(s: Entry['source']) {
  if (s === 'lifecycle') return 'Server lifecycle';
  if (s === 'client') return 'Client telemetry';
  return 'Audit trail';
}
