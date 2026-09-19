'use client';

/** Admin document template builder — body text with {{variable}} placeholders. */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import DocumentTemplateForm, {
  emptyDocumentTemplateForm, validateDocumentTemplateForm, type DocumentTemplateFormValue,
} from '@/components/DocumentTemplateForm';
import { DOCUMENT_STARTER_TEMPLATES } from '@/lib/document-starter-templates';

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [form, setForm] = useState<DocumentTemplateFormValue>(emptyDocumentTemplateForm());
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showStarters, setShowStarters] = useState(false);

  useEffect(() => {
    fetch('/api/document-templates').then(async (r) => {
      if (r.status === 401) { window.location.href = '/login'; return; }
      const d = await r.json();
      setTemplates(d.templates ?? []);
    });
  }, [saved]);

  function startBlank() {
    setForm(emptyDocumentTemplateForm());
    setError('');
    setShowStarters(false);
    setShowForm(true);
  }

  function startFromTemplate(starterId: string) {
    const starter = DOCUMENT_STARTER_TEMPLATES.find((t) => t.id === starterId);
    if (!starter) return;
    setForm({ name: starter.name, body: starter.body, variables: starter.variables });
    setError('');
    setShowStarters(false);
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const validationError = validateDocumentTemplateForm(form);
    if (validationError) { setError(validationError); return; }

    const res = await fetch('/api/document-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, body: form.body, variables: form.variables }),
    });
    const d = await res.json();
    if (!res.ok) { setError(d.error ?? 'failed'); return; }
    setSaved(!saved);
    setForm(emptyDocumentTemplateForm());
    setShowForm(false);
  }

  return (
    <div className="app-layout">
      <TopBar role="admin" />
      <main className="shell">
        <div className="page-header row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="eyebrow">Configuration</div>
            <h1>Document Templates</h1>
          </div>
          <div className="row">
            <Link href="/admin/documents"><button className="ghost">← Back to document sessions</button></Link>
            {!showForm && (
              <button className="primary" onClick={() => setShowStarters(true)}>+ New template</button>
            )}
          </div>
        </div>

        {showStarters && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Start a new template</h2>
              <button className="ghost" onClick={() => setShowStarters(false)}>Cancel</button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Pick a ready-made agreement to start from and edit it, or start from a blank page.
            </p>
            <div className="starter-grid">
              <button type="button" className="starter-card starter-card--blank" onClick={startBlank}>
                <div className="starter-card-title">+ Blank document</div>
                <div className="starter-card-desc">Start from an empty page and write your own.</div>
              </button>
              {DOCUMENT_STARTER_TEMPLATES.map((t) => (
                <button type="button" key={t.id} className="starter-card" onClick={() => startFromTemplate(t.id)}>
                  <div className="starter-card-title">{t.name}</div>
                  <div className="starter-card-desc">{t.description}</div>
                  <div className="starter-card-meta">{t.variables.length} fields</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {showForm && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
              <button className="ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
            <DocumentTemplateForm value={form} onChange={setForm} onSubmit={save} error={error} submitLabel="Save template" />
          </div>
        )}

        <h2>Existing document templates</h2>
        {templates.length === 0 ? (
          <div className="card"><div className="empty-state">No document templates yet. Click "+ New template" to create one.</div></div>
        ) : (
          <div className="starter-grid">
            {templates.map((tpl) => {
              const preview = String(tpl.body ?? '').replace(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g, '_____').slice(0, 160);
              return (
                <Link key={tpl.id} href={`/admin/documents/templates/${tpl.id}`} className="starter-card template-card">
                  <div className="starter-card-title">{tpl.name}</div>
                  <div className="template-card-preview">{preview}{preview.length >= 160 ? '…' : ''}</div>
                  <div className="starter-card-meta row" style={{ justifyContent: 'space-between' }}>
                    <span>{(tpl.variables ?? []).length} fields · v{tpl.version}</span>
                    <span>{new Date(tpl.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
