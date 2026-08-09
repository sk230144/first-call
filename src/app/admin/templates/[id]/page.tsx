'use client';

/** Edit an existing template. Sessions pin their own template_version and
 * variable_values at creation time, so editing here only affects sessions
 * created after the save — past sessions are unaffected. */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import TemplateForm, { validateTemplateForm, type TemplateFormValue, type Q, type V } from '@/components/TemplateForm';

export default function EditTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<TemplateFormValue | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/templates/${id}`);
    if (r.status === 401) { window.location.href = '/login'; return; }
    if (!r.ok) { setNotFound(true); return; }
    const { template } = await r.json();
    const questions: Q[] = (template.questions ?? []).map((q: any) => ({
      id: q.id ?? crypto.randomUUID(), order: q.order, text: q.text, video_url: q.video_url ?? '',
    }));
    const variables: V[] = template.variables ?? [];
    setForm({
      name: template.name,
      language: template.language,
      consent: template.consent_language,
      webhookUrl: template.webhook_url ?? '',
      questions: questions.length > 0 ? questions : [{ id: crypto.randomUUID(), order: 1, text: '', video_url: '' }],
      variables,
    });
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');

    const validationError = validateTemplateForm(form);
    if (validationError) { setError(validationError); return; }

    setBusy(true);
    const res = await fetch(`/api/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, language: form.language, consent_language: form.consent,
        webhook_url: form.webhookUrl || null,
        questions: form.questions.filter((q) => q.text.trim()).map((q, i) => ({ ...q, order: i + 1, video_url: q.video_url || null })),
        variables: form.variables,
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { setError(d.error ?? 'failed'); return; }
    router.push('/admin/templates');
  }

  if (notFound) {
    return (
      <div className="app-layout">
        <TopBar role="admin" />
        <main className="shell"><p className="error">Template not found.</p></main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <TopBar role="admin" />
      <main className="shell">
        <div className="page-header row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="eyebrow">Configuration</div>
            <h1>Edit template</h1>
          </div>
          <Link href="/admin/templates"><button className="ghost">← Back to templates</button></Link>
        </div>
        {!form
          ? <p className="muted">Loading…</p>
          : (
            <div className="card">
              <TemplateForm value={form} onChange={setForm} onSubmit={save} error={error} submitLabel={busy ? 'Saving…' : 'Save changes'} />
            </div>
          )}
      </main>
    </div>
  );
}
