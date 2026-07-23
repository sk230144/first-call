'use client';

/** Admin template builder — ordered yes/no questions with per-question videos. */

import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';

type Q = { id: string; order: number; text: string; video_url: string };
type V = { key: string; label: string; required: boolean };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [consent, setConsent] = useState('This call will be recorded for compliance purposes.');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [questions, setQuestions] = useState<Q[]>([{ id: crypto.randomUUID(), order: 1, text: '', video_url: '' }]);
  const [variables, setVariables] = useState<V[]>([]);
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
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, language, consent_language: consent,
        webhook_url: webhookUrl || null,
        questions: questions.filter((q) => q.text.trim()).map((q, i) => ({ ...q, order: i + 1, video_url: q.video_url || null })),
        variables,
      }),
    });
    const d = await res.json();
    if (!res.ok) { setError(d.error ?? 'failed'); return; }
    setSaved(!saved);
    setName(''); setQuestions([{ id: crypto.randomUUID(), order: 1, text: '', video_url: '' }]); setVariables([]);
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
          <form onSubmit={save}>
            <label>Template name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Solar welcome call v1" />
            <div className="row">
              <div style={{ flex: 1 }}>
                <label>Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="en-US">English (en-US)</option>
                  <option value="es-US">Spanish (es-US)</option>
                </select>
              </div>
              <div style={{ flex: 2 }}>
                <label>Webhook URL (optional)</label>
                <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <label>Consent language</label>
            <textarea rows={2} value={consent} onChange={(e) => setConsent(e.target.value)} />

            <h2>Questions (in order) — use {'{{variable}}'} for dynamic values</h2>
            {questions.map((q, i) => (
              <div key={q.id} className="row" style={{ marginBottom: 8 }}>
                <span className="muted">{i + 1}.</span>
                <input style={{ flex: 3 }} placeholder="Do you understand that {{monthly_payment}} will be your monthly payment?"
                  value={q.text} onChange={(e) => setQuestions(questions.map((x) => x.id === q.id ? { ...x, text: e.target.value } : x))} />
                <input style={{ flex: 2 }} placeholder="Question video URL (mp4, optional)"
                  value={q.video_url} onChange={(e) => setQuestions(questions.map((x) => x.id === q.id ? { ...x, video_url: e.target.value } : x))} />
                <button type="button" className="ghost" onClick={() => setQuestions(questions.filter((x) => x.id !== q.id))}>✕</button>
              </div>
            ))}
            <button type="button" className="ghost" onClick={() => setQuestions([...questions, { id: crypto.randomUUID(), order: questions.length + 1, text: '', video_url: '' }])}>
              + Add question
            </button>

            <h2>Variables</h2>
            {variables.map((v, i) => (
              <div key={i} className="row" style={{ marginBottom: 8 }}>
                <input style={{ flex: 1 }} placeholder="key (e.g. monthly_payment)"
                  value={v.key} onChange={(e) => setVariables(variables.map((x, j) => j === i ? { ...x, key: e.target.value.replace(/\W/g, '_') } : x))} />
                <input style={{ flex: 2 }} placeholder="Label (e.g. Monthly payment)"
                  value={v.label} onChange={(e) => setVariables(variables.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <label className="row" style={{ margin: 0 }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={v.required}
                    onChange={(e) => setVariables(variables.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))} /> required
                </label>
                <button type="button" className="ghost" onClick={() => setVariables(variables.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button type="button" className="ghost" onClick={() => setVariables([...variables, { key: '', label: '', required: true }])}>
              + Add variable
            </button>

            {error && <p className="error">{error}</p>}
            <div style={{ marginTop: 20 }}>
              <button className="primary">Save template</button>
            </div>
          </form>
        </div>

        <h2>Existing templates</h2>
        <div className="card flush">
          <table className="grid" style={{ border: 'none', borderRadius: 0 }}>
            <thead><tr><th>Name</th><th>Version</th><th>Language</th><th>Questions</th><th>Created</th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td>v{t.version}</td>
                  <td>{t.language}</td>
                  <td>{(t.questions ?? []).length}</td>
                  <td className="muted">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state">No templates yet.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
