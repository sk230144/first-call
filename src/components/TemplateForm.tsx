'use client';

/** Shared question/variable builder form, used for both creating and editing templates. */

import { useState } from 'react';
import { useT } from '@/lib/i18n/LocaleProvider';

export type Q = { id: string; order: number; text: string; video_url: string };
export type V = { key: string; label: string; required: boolean };

export type TemplateFormValue = {
  name: string;
  language: string;
  consent: string;
  webhookUrl: string;
  questions: Q[];
  variables: V[];
};

export function emptyTemplateForm(): TemplateFormValue {
  return {
    name: '',
    language: 'en-US',
    consent: 'This call will be recorded for compliance purposes.',
    webhookUrl: '',
    questions: [{ id: crypto.randomUUID(), order: 1, text: '', video_url: '' }],
    variables: [],
  };
}

/** Every {{key}} referenced in question text or consent language. */
export function referencedVariableKeys(consent: string, questions: Q[]): string[] {
  const text = [consent, ...questions.map((q) => q.text)].join(' ');
  const matches = [...text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(matches)];
}

/** monthly_payment -> Monthly Payment */
export function labelFromKey(key: string): string {
  return key.split('_').filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Scans questions/consent for {{key}} placeholders and adds a required
 * variable for any key that doesn't already have one defined. Existing
 * variables (including any manual edits) are left untouched.
 */
export function importVariablesFromQuestions(value: TemplateFormValue): TemplateFormValue {
  const referenced = referencedVariableKeys(value.consent, value.questions);
  const existingKeys = new Set(value.variables.map((v) => v.key));
  const imported: V[] = referenced
    .filter((key) => !existingKeys.has(key))
    .map((key) => ({ key, label: labelFromKey(key), required: true }));
  if (imported.length === 0) return value;
  return { ...value, variables: [...value.variables, ...imported] };
}

/** Returns an error string if the form is invalid, else null. Every {{variable}}
 * used in a question must have a required variable defined, or the customer
 * will see the literal "{{key}}" placeholder instead of real data. */
export function validateTemplateForm(value: TemplateFormValue): string | null {
  const referenced = referencedVariableKeys(value.consent, value.questions);
  const definedKeys = new Set(value.variables.map((v) => v.key));
  const undefinedKeys = referenced.filter((k) => !definedKeys.has(k));
  if (undefinedKeys.length > 0) {
    return `These variables are used in your questions but not defined below: ${undefinedKeys.join(', ')}`;
  }
  const notRequired = value.variables.filter((v) => referenced.includes(v.key) && !v.required).map((v) => v.key);
  if (notRequired.length > 0) {
    return `These variables are used in a question and must be marked "required" so every session gets real data: ${notRequired.join(', ')}`;
  }
  return null;
}

export default function TemplateForm({
  value, onChange, onSubmit, error, submitLabel,
}: {
  value: TemplateFormValue;
  onChange: (v: TemplateFormValue) => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string;
  submitLabel: string;
}) {
  const t = useT();
  const { name, language, consent, webhookUrl, questions, variables } = value;
  const set = (patch: Partial<TemplateFormValue>) => onChange({ ...value, ...patch });

  const referenced = referencedVariableKeys(consent, questions);
  const existingKeys = new Set(variables.map((v) => v.key));
  const undetectedCount = referenced.filter((k) => !existingKeys.has(k)).length;

  return (
    <form onSubmit={onSubmit}>
      <label>{t('form.templateName')}</label>
      <input value={name} onChange={(e) => set({ name: e.target.value })} required placeholder="New customer agreement v1" />
      <div className="row">
        <div style={{ flex: 1 }}>
          <label>{t('form.language')}</label>
          <select value={language} onChange={(e) => set({ language: e.target.value })}>
            <option value="en-US">English (en-US)</option>
            <option value="es-US">Spanish (es-US)</option>
            <option value="hi-IN">Hindi (hi-IN)</option>
            <option value="ta-IN">Tamil (ta-IN)</option>
            <option value="te-IN">Telugu (te-IN)</option>
            <option value="kn-IN">Kannada (kn-IN)</option>
            <option value="ml-IN">Malayalam (ml-IN)</option>
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <label>{t('form.webhookUrl')}</label>
          <input value={webhookUrl} onChange={(e) => set({ webhookUrl: e.target.value })} placeholder="https://..." />
        </div>
      </div>
      <label>{t('form.consentLanguage')}</label>
      <textarea rows={2} value={consent} onChange={(e) => set({ consent: e.target.value })} />

      <h2>{t('form.questionsHeading')}</h2>
      {questions.map((q, i) => (
        <div key={q.id} className="row" style={{ marginBottom: 8 }}>
          <span className="muted">{i + 1}.</span>
          <input style={{ flex: 3 }} placeholder={t('form.questionPlaceholder')}
            value={q.text} onChange={(e) => set({ questions: questions.map((x) => x.id === q.id ? { ...x, text: e.target.value } : x) })} />
          <input style={{ flex: 2 }} placeholder={t('form.questionVideoPlaceholder')}
            value={q.video_url} onChange={(e) => set({ questions: questions.map((x) => x.id === q.id ? { ...x, video_url: e.target.value } : x) })} />
          <button type="button" className="ghost" onClick={() => set({ questions: questions.filter((x) => x.id !== q.id) })}>✕</button>
        </div>
      ))}
      <button type="button" className="ghost" onClick={() => set({ questions: [...questions, { id: crypto.randomUUID(), order: questions.length + 1, text: '', video_url: '' }] })}>
        {t('form.addQuestion')}
      </button>

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2>{t('templates.variables')}</h2>
        <button type="button" className="ghost" onClick={() => set(importVariablesFromQuestions(value))}>
          {t('form.importFromQuestions')}{undetectedCount > 0 ? ` ${t('form.newCount', { count: undetectedCount })}` : ''}
        </button>
      </div>
      {undetectedCount > 0 && (
        <p className="muted" style={{ marginTop: -8, marginBottom: 12 }}>
          {t('form.undefinedHint', { count: undetectedCount })}
        </p>
      )}
      {variables.map((v, i) => (
        <div key={i} className="row" style={{ marginBottom: 8 }}>
          <input style={{ flex: 1 }} placeholder={t('form.keyPlaceholder')}
            value={v.key} onChange={(e) => set({ variables: variables.map((x, j) => j === i ? { ...x, key: e.target.value.replace(/\W/g, '_') } : x) })} />
          <input style={{ flex: 2 }} placeholder={t('form.labelPlaceholder')}
            value={v.label} onChange={(e) => set({ variables: variables.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
          <label className="row" style={{ margin: 0 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={v.required}
              onChange={(e) => set({ variables: variables.map((x, j) => j === i ? { ...x, required: e.target.checked } : x) })} /> {t('form.required')}
          </label>
          <button type="button" className="ghost" onClick={() => set({ variables: variables.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <button type="button" className="ghost" onClick={() => set({ variables: [...variables, { key: '', label: '', required: true }] })}>
        {t('form.addVariable')}
      </button>

      {error && <p className="error">{error}</p>}
      <div style={{ marginTop: 20 }}>
        <button className="primary">{submitLabel}</button>
      </div>
    </form>
  );
}
