'use client';

/** Admin template builder — ordered yes/no questions with per-question videos. */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import TemplateForm, { emptyTemplateForm, validateTemplateForm, type TemplateFormValue } from '@/components/TemplateForm';
import { useT } from '@/lib/i18n/LocaleProvider';

export default function TemplatesPage() {
  const t = useT();
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
          <div className="eyebrow">{t('templates.eyebrow')}</div>
          <h1>{t('templates.title')}</h1>
        </div>

        <div className="card">
          <TemplateForm value={form} onChange={setForm} onSubmit={save} error={error} submitLabel={t('form.saveTemplate')} />
        </div>

        <h2>{t('templates.existing')}</h2>
        <div className="card flush">
          <table className="grid" style={{ border: 'none', borderRadius: 0 }}>
            <thead><tr><th>{t('templates.name')}</th><th>{t('templates.version')}</th><th>{t('common.language')}</th><th>{t('templates.questions')}</th><th>{t('templates.variables')}</th><th>{t('templates.created')}</th><th></th></tr></thead>
            <tbody>
              {templates.map((tpl) => (
                <tr key={tpl.id}>
                  <td><strong>{tpl.name}</strong></td>
                  <td>v{tpl.version}</td>
                  <td>{tpl.language}</td>
                  <td>{(tpl.questions ?? []).length}</td>
                  <td>{(tpl.variables ?? []).length}</td>
                  <td className="muted">{new Date(tpl.created_at).toLocaleDateString()}</td>
                  <td><Link href={`/admin/templates/${tpl.id}`}>{t('templates.edit')}</Link></td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state">{t('templates.noneYet')}</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
