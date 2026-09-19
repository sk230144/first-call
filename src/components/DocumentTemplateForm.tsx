'use client';

/**
 * Shared document-body/field builder form, used for both creating and
 * editing document templates.
 *
 * Non-technical by design: the admin never sees or types {{key}} syntax.
 * They write the document as normal text in FieldEditor and click
 * "+ Insert field" to drop in a fill-in-the-blank, naming it in plain
 * language (e.g. "Provider Name"). The {{key}} storage format underneath
 * is generated automatically and never shown.
 */

import FieldEditor from './FieldEditor';

export type DocV = { key: string; label: string; required: boolean };

export type DocumentTemplateFormValue = {
  name: string;
  body: string;
  variables: DocV[];
};

export function emptyDocumentTemplateForm(): DocumentTemplateFormValue {
  return { name: '', body: '', variables: [] };
}

/** Every {{key}} referenced in the document body, in first-appearance order. */
export function referencedVariableKeys(body: string): string[] {
  const matches = [...body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(matches)];
}

/** provider_name -> Provider Name */
export function labelFromKey(key: string): string {
  return key.split('_').filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Keeps `variables` in sync with whatever fields actually exist in the
 * document body: adds an entry (required by default) for any new field
 * inserted via FieldEditor, and drops entries for fields that were
 * deleted from the text. Existing entries (including a renamed label or
 * a manually-unchecked "required") are left untouched.
 */
export function syncVariablesToBody(value: DocumentTemplateFormValue): DocumentTemplateFormValue {
  const referenced = referencedVariableKeys(value.body);
  const referencedSet = new Set(referenced);
  const existingByKey = new Map(value.variables.map((v) => [v.key, v]));

  const next: DocV[] = referenced.map(
    (key) => existingByKey.get(key) ?? { key, label: labelFromKey(key), required: true }
  );
  // No-op guard so callers can call this freely without triggering extra renders.
  const unchanged =
    next.length === value.variables.length &&
    next.every((v, i) => v === value.variables[i]);
  if (unchanged) return value;
  return { ...value, variables: next };
}

/** Returns an error string if the form is invalid, else null. Every field
 * inserted in the document must be marked required, or the customer could
 * leave it blank and the signed document would still show a placeholder. */
export function validateDocumentTemplateForm(value: DocumentTemplateFormValue): string | null {
  if (!value.body.trim()) return 'The document is empty.';
  const referenced = referencedVariableKeys(value.body);
  const definedKeys = new Set(value.variables.map((v) => v.key));
  const undefinedKeys = referenced.filter((k) => !definedKeys.has(k));
  if (undefinedKeys.length > 0) {
    // Shouldn't normally happen since syncVariablesToBody keeps these in
    // sync automatically, but guards against a stale save.
    return 'Some fields in your document need to be added to the list below. Try re-opening the document editor.';
  }
  const notRequired = value.variables.filter((v) => referenced.includes(v.key) && !v.required).map((v) => v.label || v.key);
  if (notRequired.length > 0) {
    return `These fields must stay required so the customer always fills them in: ${notRequired.join(', ')}`;
  }
  return null;
}

export default function DocumentTemplateForm({
  value, onChange, onSubmit, error, submitLabel,
}: {
  value: DocumentTemplateFormValue;
  onChange: (v: DocumentTemplateFormValue) => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string;
  submitLabel: string;
}) {
  const { name, body, variables } = value;

  function setBody(nextBody: string) {
    onChange(syncVariablesToBody({ ...value, body: nextBody }));
  }

  function renameField(key: string, label: string) {
    onChange({ ...value, variables: variables.map((v) => (v.key === key ? { ...v, label } : v)) });
  }

  const knownLabels = Object.fromEntries(variables.map((v) => [v.key, v.label || labelFromKey(v.key)]));

  return (
    <form onSubmit={onSubmit}>
      <label>Document name</label>
      <input value={name} onChange={(e) => onChange({ ...value, name: e.target.value })} required placeholder="SaaS Agreement" />

      <label>Document text</label>
      <p className="muted" style={{ marginTop: -4, marginBottom: 8 }}>
        Write the document like a normal letter. Where you need the customer to fill in something
        (their name, an address, a date), click <strong>+ Insert field</strong> instead of typing it.
      </p>
      <FieldEditor
        value={body}
        onChange={setBody}
        knownLabels={knownLabels}
        placeholder="This agreement is entered into by..."
      />

      <h2>Fields in this document</h2>
      {variables.length === 0 && (
        <p className="muted">No fields yet — use "+ Insert field" above to add one.</p>
      )}
      {variables.map((v) => (
        <div key={v.key} className="row" style={{ marginBottom: 8 }}>
          <input
            style={{ flex: 1 }}
            value={v.label}
            onChange={(e) => renameField(v.key, e.target.value)}
            placeholder="Field name"
          />
          <span className="muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>customer must fill this in</span>
        </div>
      ))}

      {error && <p className="error">{error}</p>}
      <div style={{ marginTop: 20 }}>
        <button className="primary">{submitLabel}</button>
      </div>
    </form>
  );
}
