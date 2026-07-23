'use client';

/**
 * Agent dashboard: create sessions, copy the one-time link,
 * monitor completion status.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { supabaseBrowser } from '@/lib/supabase-browser';

type TemplateLite = {
  id: string; name: string;
  variables: { key: string; label: string; required: boolean }[];
};
type SessionLite = {
  id: string; customer_name: string; status: string;
  assembly_status: string; recovery_state: string; created_at: string;
};

export default function Dashboard() {
  const [role, setRole] = useState<'admin' | 'agent'>('agent');
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [createdLink, setCreatedLink] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [sRes, tRes] = await Promise.all([fetch('/api/sessions'), fetch('/api/templates')]);
    if (sRes.status === 401) { window.location.href = '/login'; return; }
    const s = await sRes.json();
    const t = await tRes.json();
    setSessions(s.sessions ?? []);
    setTemplates(t.templates ?? []);
    const { data: { user } } = await supabaseBrowser().auth.getUser();
    if (user) {
      const { data } = await supabaseBrowser().from('profiles').select('role').eq('id', user.id).single();
      if (data) setRole(data.role);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const template = templates.find((t) => t.id === selectedTemplate);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const variable_values: Record<string, string> = {};
    for (const v of template?.variables ?? []) variable_values[v.key] = form[`var_${v.key}`] ?? '';
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: selectedTemplate,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email,
        customer_address: form.customer_address,
        variable_values,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'failed'); return; }
    setCreatedLink(data.link);
    setShowForm(false);
    setForm({});
    void load();
  }

  return (
    <div className="app-layout">
      <TopBar role={role} />
      <main className="shell">
        <div className="page-header row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="eyebrow">Dashboard</div>
            <h1>Sessions</h1>
          </div>
          <button className="primary" onClick={() => { setShowForm(!showForm); setCreatedLink(''); }}>
            {showForm ? 'Cancel' : '+ New session'}
          </button>
        </div>

        {createdLink && (
          <div className="card highlight" style={{ marginTop: 24 }}>
            <strong>Session created.</strong> Send this one-time link to the customer (SMS or email):
            <p style={{ wordBreak: 'break-all', margin: '8px 0' }}><code>{createdLink}</code></p>
            <button className="ghost" onClick={() => navigator.clipboard.writeText(createdLink)}>Copy link</button>
          </div>
        )}

        {showForm && (
          <div className="card">
            <form onSubmit={createSession}>
              <label>Template</label>
              <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} required>
                <option value="">Select…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <label>Customer name</label>
              <input value={form.customer_name ?? ''} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
              <label>Phone</label>
              <input value={form.customer_phone ?? ''} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
              <label>Email</label>
              <input type="email" value={form.customer_email ?? ''} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
              <label>Address</label>
              <input value={form.customer_address ?? ''} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} />
              {(template?.variables ?? []).map((v) => (
                <div key={v.key}>
                  <label>{v.label}{v.required ? ' *' : ''}</label>
                  <input
                    value={form[`var_${v.key}`] ?? ''}
                    onChange={(e) => setForm({ ...form, [`var_${v.key}`]: e.target.value })}
                    required={v.required}
                  />
                </div>
              ))}
              {error && <p className="error">{error}</p>}
              <div style={{ marginTop: 16 }}>
                <button className="primary">Create session &amp; get link</button>
              </div>
            </form>
          </div>
        )}

        <div className="card flush" style={{ marginTop: 24 }}>
          <table className="grid" style={{ border: 'none', borderRadius: 0 }}>
            <thead>
              <tr><th>Customer</th><th>Status</th><th>Assembly</th><th>Recovery</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.customer_name}</strong></td>
                  <td><span className={`pill ${s.status}`}>{s.status}</span></td>
                  <td><span className={`pill ${s.assembly_status}`}>{s.assembly_status.replace('_', ' ')}</span></td>
                  <td>{s.recovery_state !== 'none' && <span className={`pill ${s.recovery_state}`}>{s.recovery_state}</span>}</td>
                  <td className="muted">{new Date(s.created_at).toLocaleString()}</td>
                  <td><Link href={`/admin/review/${s.id}`}>View →</Link></td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state">No sessions yet. Create one to get started.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
