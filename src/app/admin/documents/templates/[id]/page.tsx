'use client';

/** Edit an existing document template. Document sessions pin their own
 * template_version + variable_values at creation time, so editing here
 * only affects sessions created after the save. */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import DocumentTemplateForm, {
  validateDocumentTemplateForm, type DocumentTemplateFormValue, type DocV,
} from '@/components/DocumentTemplateForm';

export default function EditDocumentTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<DocumentTemplateFormValue | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/document-templates/${id}`);
    if (r.status === 401) { window.location.href = '/login'; return; }
    if (!r.ok) { setNotFound(true); return; }
    const { template } = await r.json();
    const variables: DocV[] = template.variables ?? [];
    setForm({ name: template.name, body: template.body ?? '', variables });
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');

    const validationError = validateDocumentTemplateForm(form);
    if (validationError) { setError(validationError); return; }

    setBusy(true);
    const res = await fetch(`/api/document-templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, body: form.body, variables: form.variables }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { setError(d.error ?? 'failed'); return; }
    router.push('/admin/documents/templates');
  }

  if (notFound) {
    return (
      <div className="app-layout">
        <TopBar role="admin" />
        <main className="shell"><p className="error">Document template not found.</p></main>
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
            <h1>Edit document template</h1>
          </div>
          <Link href="/admin/documents/templates"><button className="ghost">← Back to templates</button></Link>
        </div>
        {!form
          ? <p className="muted">Loading…</p>
          : (
            <div className="card">
              <DocumentTemplateForm value={form} onChange={setForm} onSubmit={save} error={error} submitLabel={busy ? 'Saving…' : 'Save changes'} />
            </div>
          )}
      </main>
    </div>
  );
}
