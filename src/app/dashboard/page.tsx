'use client';

/**
 * Agent dashboard: create sessions, copy the one-time link,
 * monitor completion status.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import Modal from '@/components/Modal';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useT } from '@/lib/i18n/LocaleProvider';

type TemplateLite = {
  id: string; name: string;
  variables: { key: string; label: string; required: boolean }[];
};
type SessionLite = {
  id: string; customer_name: string; status: string;
  assembly_status: string; recovery_state: string; created_at: string;
};

export default function Dashboard() {
  const t = useT();
  const [role, setRole] = useState<'admin' | 'agent'>('agent');
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
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
    const [sRes, tRes] = await Promise.all([fetch('/api/sessions'), fetch('/api/templates')]);
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
    setCreating(false);
    if (!res.ok) { setError(data.error ?? t('dashboard.createFailed')); return; }
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
            <div className="eyebrow">{t('dashboard.eyebrow')}</div>
            <h1>{t('dashboard.title')}</h1>
          </div>
          <button className="primary" onClick={openForm}>{t('dashboard.newSession')}</button>
        </div>

        {createdLink && (
          <div className="card highlight" style={{ marginTop: 24 }}>
            <strong>{t('dashboard.sessionCreated')}</strong> {t('dashboard.sendLink')}
            <p style={{ wordBreak: 'break-all', margin: '8px 0' }}><code>{createdLink}</code></p>
            <div className="row">
              <button className="primary" onClick={copyLink}>{copied ? t('common.copied') : t('common.copyLink')}</button>
              <button className="ghost" onClick={() => setCreatedLink('')}>{t('common.dismiss')}</button>
            </div>
          </div>
        )}

        <Modal
          open={showForm}
          onClose={() => setShowForm(false)}
          title={t('dashboard.modalTitle')}
          subtitle={t('dashboard.modalSubtitle')}
          width={560}
          footer={
            <>
              <button type="button" className="ghost" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
              <button className="primary" type="submit" form="new-session-form" disabled={creating}>
                {creating ? t('dashboard.creating') : t('dashboard.createSession')}
              </button>
            </>
          }
        >
          <form id="new-session-form" onSubmit={createSession}>
            <label htmlFor="session-template">{t('dashboard.template')}</label>
            <select id="session-template" value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} required>
              <option value="">{t('dashboard.selectEllipsis')}</option>
              {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
            </select>
            <label htmlFor="customer-name">{t('dashboard.customerName')}</label>
            <input id="customer-name" autoComplete="name" value={form.customer_name ?? ''} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
            <div className="field-pair">
              <div>
                <label htmlFor="customer-phone">{t('dashboard.phone')}</label>
                <input id="customer-phone" type="tel" autoComplete="tel" value={form.customer_phone ?? ''} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
              </div>
              <div>
                <label htmlFor="customer-email">{t('dashboard.email')}</label>
                <input id="customer-email" type="email" autoComplete="email" value={form.customer_email ?? ''} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
              </div>
            </div>
            <label htmlFor="customer-address">{t('dashboard.address')}</label>
            <input id="customer-address" autoComplete="street-address" value={form.customer_address ?? ''} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} />
            {(template?.variables ?? []).length > 0 && (
              <div className="modal-subsection">
                <span className="eyebrow">{t('dashboard.templateDetails')}</span>
                {(template?.variables ?? []).map((v) => (
                  <div key={v.key}>
                    <label htmlFor={`session-var-${v.key}`}>{v.label}{v.required ? ' *' : ''}</label>
                    <input
                      id={`session-var-${v.key}`} value={form[`var_${v.key}`] ?? ''}
                      onChange={(e) => setForm({ ...form, [`var_${v.key}`]: e.target.value })}
                      required={v.required}
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
              <tr><th>{t('dashboard.customer')}</th><th>{t('dashboard.status')}</th><th>{t('dashboard.assembly')}</th><th>{t('dashboard.recovery')}</th><th>{t('dashboard.created')}</th><th></th></tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.customer_name}</strong></td>
                  <td><span className={`pill ${s.status}`}>{s.status}</span></td>
                  <td><span className={`pill ${s.assembly_status}`}>{s.assembly_status.replace('_', ' ')}</span></td>
                  <td>{s.recovery_state !== 'none' && <span className={`pill ${s.recovery_state}`}>{s.recovery_state}</span>}</td>
                  <td className="muted">{new Date(s.created_at).toLocaleString()}</td>
                  <td><Link href={`/admin/review/${s.id}`}>{t('dashboard.view')}</Link></td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state">{t('dashboard.noSessions')}</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
