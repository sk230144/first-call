'use client';

/**
 * Document sessions dashboard: create a document session for a customer,
 * copy the one-time link, monitor signing status.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import Modal from '@/components/Modal';
import { supabaseBrowser } from '@/lib/supabase-browser';

type DocTemplateLite = {
  id: string; name: string;
  variables: { key: string; label: string; required: boolean }[];
};
type DocSessionLite = {
  id: string; customer_name: string; status: string;
  signed_at: string | null; created_at: string;
};

export default function DocumentsDashboard() {
  const [role, setRole] = useState<'admin' | 'agent'>('agent');
  const [sessions, setSessions] = useState<DocSessionLite[]>([]);
  const [templates, setTemplates] = useState<DocTemplateLite[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [createdLink, setCreatedLink] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  function openForm() {
    setForm({});
    setSelectedTemplate('');
    setError('');
    setCreatedLink('');
    setShowForm(true);
  }

  const load = useCallback(async () => {
    const [sRes, tRes] = await Promise.all([fetch('/api/document-sessions'), fetch('/api/document-templates')]);
    if (sRes.status === 401) { window.location.href = '/login'; return; }
    const sData = await sRes.json();
    const tData = await tRes.json();
    setSessions(sData.sessions ?? []);
    setTemplates(tData.templates ?? []);
    const { data: { user } } = await supabaseBrowser().auth.getUser();
    if (user) {
      const { data } = await supabaseBrowser().from('profiles').select('role').eq('id', user.id).single();
      if (data) setRole(data.role);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const template = templates.find((tpl) => tpl.id === selectedTemplate);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCreating(true);
    const variable_values: Record<string, string> = {};
    for (const v of template?.variables ?? []) variable_values[v.key] = form[`var_${v.key}`] ?? '';
    const res = await fetch('/api/document-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_template_id: selectedTemplate,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email,
        variable_values,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setError(data.error ?? 'Could not create the document session. Please try again.'); return; }
    setCreatedLink(data.link);
    setShowForm(false);
    setForm({});
    void load();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(createdLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="app-layout">
      <TopBar role={role} />
      <main className="shell">
        <div className="page-header row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="eyebrow">Documents</div>
            <h1>Document Sessions</h1>
          </div>
          <div className="row">
            <Link href="/admin/documents/templates"><button className="ghost">Manage templates</button></Link>
            <button className="primary" onClick={openForm}>+ New document</button>
          </div>
        </div>

        {createdLink && (
          <div className="card highlight" style={{ marginTop: 24 }}>
            <strong>Document session created.</strong> Send this one-time link to the customer (SMS or email):
            <p style={{ wordBreak: 'break-all', margin: '8px 0' }}><code>{createdLink}</code></p>
            <div className="row">
              <button className="primary" onClick={copyLink}>{copied ? 'Copied ✓' : 'Copy link'}</button>
              <button className="ghost" onClick={() => setCreatedLink('')}>Dismiss</button>
            </div>
          </div>
        )}

        <Modal
          open={showForm}
          onClose={() => setShowForm(false)}
          title="New document"
          subtitle="Pick a document template, then add the customer's details."
          width={560}
          footer={
            <>
              <button type="button" className="ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary" type="submit" form="new-document-form" disabled={creating}>
                {creating ? 'Creating…' : 'Create session & get link'}
              </button>
            </>
          }
        >
          <form id="new-document-form" onSubmit={createSession}>
            <label htmlFor="doc-template">Document template</label>
            <select id="doc-template" value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} required>
              <option value="">Select…</option>
              {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
            </select>
            <label htmlFor="doc-customer-name">Customer name</label>
            <input id="doc-customer-name" autoComplete="name" value={form.customer_name ?? ''} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
            <div className="field-pair">
              <div>
                <label htmlFor="doc-customer-phone">Phone</label>
                <input id="doc-customer-phone" type="tel" autoComplete="tel" value={form.customer_phone ?? ''} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
              </div>
              <div>
                <label htmlFor="doc-customer-email">Email</label>
                <input id="doc-customer-email" type="email" autoComplete="email" value={form.customer_email ?? ''} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
              </div>
            </div>
            {(template?.variables ?? []).length > 0 && (
              <div className="modal-subsection">
                <span className="eyebrow">Fields in this document</span>
                <p className="muted" style={{ marginTop: 4, marginBottom: 12 }}>
                  Leave any of these blank if the customer should fill them in themselves.
                </p>
                {(template?.variables ?? []).map((v) => (
                  <div key={v.key}>
                    <label htmlFor={`doc-var-${v.key}`}>{v.label}</label>
                    <input
                      id={`doc-var-${v.key}`} value={form[`var_${v.key}`] ?? ''}
                      onChange={(e) => setForm({ ...form, [`var_${v.key}`]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </form>
        </Modal>

        <div className="card flush" style={{ marginTop: 24 }}>
          <table className="grid" style={{ border: 'none', borderRadius: 0 }}>
            <thead>
              <tr><th>Customer</th><th>Status</th><th>Signed</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.customer_name}</strong></td>
                  <td><span className={`pill ${s.status}`}>{s.status}</span></td>
                  <td className="muted">{s.signed_at ? new Date(s.signed_at).toLocaleString() : '—'}</td>
                  <td className="muted">{new Date(s.created_at).toLocaleString()}</td>
                  <td><Link href={`/admin/documents/${s.id}`}>View →</Link></td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state">No document sessions yet.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
