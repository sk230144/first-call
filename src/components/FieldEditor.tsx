'use client';

/**
 * A plain-text editor where "fill-in fields" appear as clickable chips
 * instead of raw {{key}} syntax — so someone with no technical background
 * can build a document without ever seeing or typing placeholder markup.
 *
 * Storage format is unchanged: the value is still a plain string with
 * {{key}} markers, exactly what validateDocumentTemplateForm / the API /
 * the customer-facing preview already expect. This component only changes
 * how that string is AUTHORED — converting between the string and a
 * contentEditable DOM tree of text nodes + chip <span>s.
 */

import { useEffect, useRef } from 'react';
import { labelFromKey } from './DocumentTemplateForm';

const FIELD_TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export default function FieldEditor({
  value, onChange, knownLabels, placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  /** key -> label, so chips show "Provider Name" instead of "provider_name". */
  knownLabels: Record<string, string>;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  // Tracks the last value WE pushed into the DOM, so the sync effect can
  // tell "value changed elsewhere" apart from "value changed because of
  // our own onInput" and avoid clobbering the cursor mid-typing.
  const lastRenderedValue = useRef<string | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || value === lastRenderedValue.current) return;
    el.innerHTML = '';
    renderIntoNode(el, value, knownLabels);
    lastRenderedValue.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Field labels can change (e.g. renamed in the Fields list below) without
  // the underlying {{key}} text changing — re-render chip text in that case.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>('[data-field-key]').forEach((chip) => {
      const key = chip.dataset.fieldKey!;
      const label = knownLabels[key] ?? labelFromKey(key);
      if (chip.textContent !== label) chip.textContent = label;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownLabels]);

  function emitChange() {
    const el = editorRef.current;
    if (!el) return;
    const next = serializeNode(el);
    lastRenderedValue.current = next;
    onChange(next);
  }

  /** Prompts for a plain field name and inserts a chip at the current cursor position. */
  function insertField() {
    const label = window.prompt('What should this field be called? (e.g. "Provider Name")');
    if (!label || !label.trim()) return;
    const key = keyFromLabel(label.trim());

    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const selection = window.getSelection();
    const chip = makeChip(key, label.trim());

    if (selection && selection.rangeCount > 0 && el.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(chip);
      range.setStartAfter(chip);
      range.setEndAfter(chip);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      el.appendChild(chip);
    }
    emitChange();
  }

  return (
    <div className="field-editor-wrap">
      <div className="field-editor-toolbar">
        <button type="button" className="ghost" onClick={insertField}>+ Insert field</button>
        <span className="muted field-editor-hint">Click where you want the field, then choose a name — no code needed.</span>
      </div>
      <div
        ref={editorRef}
        className="field-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Document body"
        data-placeholder={placeholder}
        onInput={emitChange}
        onPaste={(e) => {
          // Force plain text on paste — pasted HTML could otherwise smuggle
          // in stray tags that don't round-trip through serializeNode.
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ DOM <-> string */

function makeChip(key: string, label: string): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'field-chip';
  chip.contentEditable = 'false';
  chip.dataset.fieldKey = key;
  chip.textContent = label;
  return chip;
}

function renderIntoNode(el: HTMLElement, value: string, knownLabels: Record<string, string>) {
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  FIELD_TOKEN.lastIndex = 0;
  while ((match = FIELD_TOKEN.exec(value))) {
    if (match.index > lastIndex) {
      el.appendChild(document.createTextNode(value.slice(lastIndex, match.index)));
    }
    const key = match[1];
    el.appendChild(makeChip(key, knownLabels[key] ?? labelFromKey(key)));
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length) {
    el.appendChild(document.createTextNode(value.slice(lastIndex)));
  }
}

/** Walks the editor's DOM back into a plain {{key}} string. */
function serializeNode(el: HTMLElement): string {
  let out = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
    } else if (node instanceof HTMLElement && node.dataset.fieldKey) {
      out += `{{${node.dataset.fieldKey}}}`;
    } else if (node instanceof HTMLBRElement) {
      out += '\n';
    } else if (node instanceof HTMLElement) {
      // contentEditable wraps new lines in <div>/<p> in most browsers.
      out += (out.endsWith('\n') || out === '' ? '' : '\n') + serializeNode(node);
    }
  }
  return out;
}

function keyFromLabel(label: string): string {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return key || 'field';
}
