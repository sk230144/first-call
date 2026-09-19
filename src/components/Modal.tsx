'use client';

/**
 * Centered dialog for focused tasks (creating a session, confirming an action).
 * Fixed height with only the body scrolling — header and footer stay put.
 * Handles Escape to close, background scroll lock, click-outside, and
 * returning focus to whatever opened it.
 */

import { useEffect, useRef } from 'react';

/** Always calls the latest onClose without making it an effect dependency —
 * onClose is typically a fresh inline arrow function every render (e.g.
 * onClose={() => setShowForm(false)}), which would otherwise re-trigger any
 * effect depending on it (and its cleanup) on every parent re-render, i.e.
 * on every keystroke in the form. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

// Text-entry fields only. <select> is deliberately excluded: focusing a
// dropdown means the first letter typed jumps its options instead of
// landing in the text field the user actually wants to type into.
const PREFERRED_FOCUS_SELECTOR = 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled])';
const FALLBACK_FOCUS_SELECTOR = 'select:not([disabled]), button:not([disabled]), [href]';

export default function Modal({
  open, onClose, title, subtitle, children, footer, width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Pinned below the scrolling body — actions stay reachable at any height. */
  footer?: React.ReactNode;
  width?: number;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const onCloseRef = useLatest(onClose);

  // Runs ONLY when the modal opens/closes — never on a parent re-render
  // (e.g. every keystroke updating form state), which would otherwise
  // re-steal focus away from whatever field the user is typing in.
  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first text field inside the body (not .modal-close, which
    // sits earlier in the DOM and would otherwise steal focus — a stray
    // Space or Enter while typing would then activate the button and close
    // the modal). Prefer text inputs/textareas over <select> or <button>,
    // since those appearing first would grab keystrokes meant for typing.
    const focusable =
      bodyRef.current?.querySelector<HTMLElement>(PREFERRED_FOCUS_SELECTOR) ??
      bodyRef.current?.querySelector<HTMLElement>(FALLBACK_FOCUS_SELECTOR);
    focusable?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus();
    };
  }, [open]);

  // Escape-to-close: safe to depend on onClose's latest value via a ref
  // without re-subscribing (and re-focusing) on every render.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCloseRef]);

  if (!open) return null;

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="modal-panel"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body" ref={bodyRef}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
