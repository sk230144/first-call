'use client';

/** Admin template builder — ordered yes/no questions with per-question videos. */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import TemplateForm, { emptyTemplateForm, validateTemplateForm, type TemplateFormValue } from '@/components/TemplateForm';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [form, setForm] = useState<TemplateFormValue>(emptyTemplateForm());
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/templates').then(async (r) => {
      if (r.status === 401) { window.location.href = '/login'; return; }
      const d = await r.json();
      setTemplates(d.templates ?? []);
    });
  }, [saved]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const validationError = validateTemplateForm(form);
    if (validationError) { setError(validationError); return; }

    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, language: form.language, consent_language: form.consent,
        webhook_url: form.webhookUrl || null,
        questions: form.questions.filter((q) => q.text.trim()).map((q, i) => ({ ...q, order: i + 1, video_url: q.video_url || null })),
        variables: form.variables,
      }),
    });
    const d = await res.json();
    if (!res.ok) { setError(d.error ?? 'failed'); return; }
    setSaved(!saved);
    setForm(emptyTemplateForm());
  }

  return (
    <div className="app-layout">
      <TopBar role="admin" />
      <main className="shell">
        <div className="page-header">
          <div className="eyebrow">Configuration</div>
          <h1>Question Templates</h1>
        </div>

        <div className="card">
          <TemplateForm value={form} onChange={setForm} onSubmit={save} error={error} submitLabel="Save template" />
        </div>

        <h2>Existing templates</h2>
        <div className="card flush">
          <table className="grid" style={{ border: 'none', borderRadius: 0 }}>
            <thead><tr><th>Name</th><th>Version</th><th>Language</th><th>Questions</th><th>Variables</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td>v{t.version}</td>
                  <td>{t.language}</td>
                  <td>{(t.questions ?? []).length}</td>
                  <td>{(t.variables ?? []).length}</td>
                  <td className="muted">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td><Link href={`/admin/templates/${t.id}`}>Edit →</Link></td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state">No templates yet.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
