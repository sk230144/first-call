'use client';

/**
 * Customer document-signing page — /document-session/[id]?token=...
 * State machine: loading → filling (form + live preview) → signing →
 * submitting → done
 * The camera starts recording as soon as the customer reaches "signing" —
 * they see their own live video next to the document and read a spoken
 * confirmation statement aloud, then that same recording is stopped and
 * uploaded as proof right after a successful "Sign & submit".
 * No login: the token in the URL is the only credential.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import type { DocumentVariable } from '@/lib/document-types';
import SignaturePad, { type SignaturePadHandle } from '@/components/SignaturePad';
import { SimpleRecorder } from '@/lib/call/simpleRecorder';

type Phase = 'loading' | 'error' | 'filling' | 'signing' | 'submitting' | 'done';
type CameraState = 'idle' | 'starting' | 'recording' | 'denied' | 'stopped';

const PAGE_CSS = `
  .doc-page { min-height: 100dvh; background: var(--bg); color: var(--text); }
  .doc-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 24px; border-bottom: 1px solid var(--border-soft);
  }
  .doc-progress { font-size: 12px; color: var(--text3); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .doc-layout { display: grid; grid-template-columns: 380px 1fr; gap: 0; min-height: calc(100dvh - 60px); }
  .doc-form-pane {
    padding: 24px; border-right: 1px solid var(--border-soft); overflow-y: auto;
    max-height: calc(100dvh - 60px);
  }
  .doc-preview-pane { padding: 32px; overflow-y: auto; max-height: calc(100dvh - 60px); display: flex; justify-content: center; }
  .doc-preview-sheet {
    background: #ffffff; color: #111; max-width: 720px; width: 100%;
    padding: 48px 56px; border-radius: 6px; box-shadow: var(--shadow-md);
    white-space: pre-wrap; line-height: 1.7; font-size: 14.5px; height: fit-content;
  }
  .doc-fill { background: #fff7cc; padding: 1px 3px; border-radius: 3px; }
  .doc-missing { background: #ffe0e0; padding: 1px 3px; border-radius: 3px; color: #a33; }
  .doc-actions { margin-top: 20px; display: flex; gap: 10px; }
  .signature-pad {
    position: relative; display: inline-block; border: 1px solid var(--border);
    border-radius: 8px; overflow: hidden; cursor: crosshair;
  }
  .signature-pad-hint {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    color: #9aa; font-size: 13px; pointer-events: none;
  }
  .sign-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
  .sign-tab {
    background: var(--surface2); border: 1px solid var(--border); color: var(--text2);
    padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 700;
  }
  .sign-tab.active { background: var(--accent-soft); color: var(--accent-strong); border-color: var(--accent); }
  .center-pane {
    min-height: 100dvh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center;
    padding: 24px; max-width: 560px; margin: 0 auto;
  }
  .confirm-video {
    width: 100%; border-radius: 10px; background: #000;
    aspect-ratio: 4 / 3; object-fit: cover;
  }
  .confirm-rec-dot { margin-top: 10px; color: #ef4444; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; }
  .confirm-statement {
    background: var(--accent-soft); border: 1px solid var(--accent); border-radius: var(--radius-sm);
    padding: 12px 14px; font-size: 13.5px; line-height: 1.5; margin: 12px 0;
  }
  .confirm-denied {
    background: #ffe0e0; border: 1px solid #e5a; border-radius: var(--radius-sm);
    padding: 12px 14px; font-size: 13px; color: #a33; margin: 12px 0;
  }
  @media (max-width: 860px) {
    .doc-layout { grid-template-columns: 1fr; }
    .doc-form-pane, .doc-preview-pane { max-height: none; }
    .doc-preview-pane { order: -1; padding: 20px; }
    .doc-preview-sheet { padding: 28px 24px; font-size: 14px; }
  }
`;

const CONFIRMATION_STATEMENT =
  'I have read this document and I am signing it of my own free will, with a clear mind and without any force or pressure.';

export default function DocumentSessionPage() {
  const { id } = useParams<{ id: string }>();
  const token = useSearchParams().get('token');

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [variables, setVariables] = useState<DocumentVariable[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn'>('typed');
  const [typedName, setTypedName] = useState('');
  const [signError, setSignError] = useState('');
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentViewUrl, setDocumentViewUrl] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [confirmationRecorded, setConfirmationRecorded] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const correlationId = useRef('');
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<SimpleRecorder | null>(null);

  const api = useCallback(
    (path: string, body: Record<string, unknown> = {}) =>
      fetch(`/api/public/document-session/${id}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, correlation_id: correlationId.current, ...body }),
      }),
    [id, token]
  );

  useEffect(() => {
    correlationId.current = crypto.randomUUID();
    if (!token) { setPhase('error'); setErrorMsg('This link is missing its access token.'); return; }
    fetch(`/api/public/document-session/${id}?token=${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setErrorMsg(
            data.error === 'session_expired' ? 'This link has expired. Please contact your representative for a new one.' :
            data.error === 'already_completed' ? 'This document has already been signed. Thank you!' :
            'This link is invalid. Please contact your representative.'
          );
          setPhase('error');
          return;
        }
        setCustomerName(data.session.customer_name);
        setTemplateName(data.template.name);
        setTemplateBody(data.template.body);
        setVariables(data.template.variables ?? []);
        setValues(data.variable_values ?? {});
        setPhase('filling');
        void api('', {}); // mark session active
      })
      .catch(() => { setErrorMsg('Could not reach the server. Please check your connection.'); setPhase('error'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  // Autosave progress as the customer types, debounced.
  useEffect(() => {
    if (phase !== 'filling') return;
    const timeout = setTimeout(() => { void api('', { variable_values: values }); }, 800);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, phase]);

  const missingRequired = variables.filter((v) => v.required && !values[v.key]?.trim());
  const canProceedToSign = missingRequired.length === 0;

  function renderPreview(): React.ReactNode {
    const parts = templateBody.split(/(\{\{\s*[a-zA-Z0-9_]+\s*\}\})/g);
    return parts.map((part, i) => {
      const match = part.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);
      if (!match) return <span key={i}>{part}</span>;
      const key = match[1];
      const val = values[key];
      if (val && val.trim()) return <span key={i} className="doc-fill">{val}</span>;
      const variable = variables.find((v) => v.key === key);
      return <span key={i} className="doc-missing">{variable?.label ?? key}</span>;
    });
  }

  // ---------- camera: starts recording as soon as the customer reaches the
  // signing step, so the whole "read the statement + sign" moment is on tape ----------
  useEffect(() => {
    if (phase !== 'signing') return;
    let cancelled = false;

    (async () => {
      setCameraState('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const recorder = new SimpleRecorder();
        recorder.start(stream);
        recorderRef.current = recorder;
        setCameraState('recording');
      } catch {
        setCameraState('denied');
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
    };
  }, [phase]);

  /** Stops the in-progress recording (if any) and uploads it. Best-effort —
   *  never blocks reaching "done" once the signature itself is submitted. */
  async function stopAndUploadConfirmationVideo() {
    const recorder = recorderRef.current;
    const stream = streamRef.current;
    if (!recorder || !stream) return;
    try {
      const blob = await recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
      const urlRes = await api('/confirmation-video-url', {});
      if (urlRes.ok) {
        const { upload_url, storage_path } = await urlRes.json();
        const putRes = await fetch(upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': 'video/webm' },
          body: blob,
        });
        if (putRes.ok) {
          await api('/confirmation-video', { storage_path });
          setConfirmationRecorded(true);
        }
      }
    } catch {
      // Camera/upload failure never blocks the already-submitted signature.
    } finally {
      recorderRef.current = null;
      streamRef.current = null;
      setCameraState('stopped');
    }
  }

  async function submitSignature() {
    setSignError('');
    let signatureValue = '';
    if (signatureType === 'typed') {
      if (!typedName.trim()) { setSignError('Please type your full name to sign.'); return; }
      signatureValue = typedName.trim();
    } else {
      if (padRef.current?.isEmpty()) { setSignError('Please draw your signature.'); return; }
      signatureValue = padRef.current?.toDataUrl() ?? '';
    }

    setPhase('submitting');
    const res = await api('/sign', {
      variable_values: values,
      signature_type: signatureType,
      signature_value: signatureValue,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSignError(data.error ?? 'Could not submit your signature. Please try again.');
      setPhase('signing');
      return;
    }
    const data = await res.json().catch(() => ({}));
    setDocumentUrl(data.document_url ?? null);
    setDocumentViewUrl(data.document_view_url ?? null);

    // The signature is already saved at this point — the confirmation video
    // is extra proof, so its upload happens after and never blocks "done".
    await stopAndUploadConfirmationVideo();
    setPhase('done');
  }

  return (
    <main className="doc-page">
      {phase === 'loading' && <div className="center-pane"><p>Loading…</p></div>}

      {phase === 'error' && (
        <div className="center-pane">
          <h1>Unable to open document</h1>
          <p>{errorMsg}</p>
        </div>
      )}

      {(phase === 'filling' || phase === 'signing' || phase === 'submitting') && (
        <>
          <div className="doc-header">
            <div>
              <strong>{templateName}</strong>
              <span className="muted" style={{ marginLeft: 10 }}>for {customerName}</span>
            </div>
            <span className="doc-progress">{phase === 'filling' ? 'Fill in your details' : 'Review & sign'}</span>
          </div>

          <div className="doc-layout">
            <div className="doc-form-pane">
              {phase === 'filling' && (
                <>
                  <h2 style={{ marginTop: 0 }}>Your details</h2>
                  <p className="muted">These fill in the document on the right as you type.</p>
                  {variables.map((v) => (
                    <div key={v.key}>
                      <label htmlFor={`field-${v.key}`}>{v.label}{v.required ? ' *' : ''}</label>
                      <input
                        id={`field-${v.key}`}
                        value={values[v.key] ?? ''}
                        onChange={(e) => setValues({ ...values, [v.key]: e.target.value })}
                      />
                    </div>
                  ))}
                  {variables.length === 0 && <p className="muted">This document has no fields to fill in.</p>}
                  <div className="doc-actions">
                    <button className="primary" disabled={!canProceedToSign} onClick={() => setPhase('signing')}>
                      Continue to sign →
                    </button>
                  </div>
                  {!canProceedToSign && (
                    <p className="muted" style={{ marginTop: 10 }}>
                      Fill in all required fields (marked *) to continue.
                    </p>
                  )}
                </>
              )}

              {(phase === 'signing' || phase === 'submitting') && (
                <>
                  <h2 style={{ marginTop: 0 }}>Sign the document</h2>
                  <p className="muted">By signing, you confirm the details on the right are accurate.</p>
                  <div className="sign-tabs">
                    <button
                      type="button" className={`sign-tab${signatureType === 'typed' ? ' active' : ''}`}
                      onClick={() => setSignatureType('typed')}
                    >
                      Type name
                    </button>
                    <button
                      type="button" className={`sign-tab${signatureType === 'drawn' ? ' active' : ''}`}
                      onClick={() => setSignatureType('drawn')}
                    >
                      Draw signature
                    </button>
                  </div>

                  {signatureType === 'typed' ? (
                    <>
                      <label htmlFor="typed-name">Full name</label>
                      <input
                        id="typed-name" value={typedName} onChange={(e) => setTypedName(e.target.value)}
                        placeholder="Your full legal name"
                        style={{ fontFamily: 'cursive', fontSize: 22 }}
                      />
                    </>
                  ) : (
                    <>
                      <SignaturePad ref={padRef} width={320} height={140} />
                      <div style={{ marginTop: 8 }}>
                        <button type="button" className="ghost" onClick={() => padRef.current?.clear()}>Clear</button>
                      </div>
                    </>
                  )}

                  <div className="confirm-statement">
                    Please read this aloud, on camera, before you submit:
                    <br /><strong>&quot;{CONFIRMATION_STATEMENT}&quot;</strong>
                  </div>

                  {(cameraState === 'starting' || cameraState === 'recording') && (
                    <>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video ref={videoRef} className="confirm-video" muted playsInline />
                      {cameraState === 'recording' && <div className="confirm-rec-dot">● Recording</div>}
                    </>
                  )}
                  {cameraState === 'denied' && (
                    <p className="confirm-denied">
                      We couldn&apos;t access your camera, so no video proof will be recorded. You can still
                      sign and submit — allow camera access and refresh this page if you&apos;d like to record it.
                    </p>
                  )}

                  {signError && <p className="error">{signError}</p>}

                  <div className="doc-actions">
                    <button className="ghost" onClick={() => setPhase('filling')} disabled={phase === 'submitting'}>← Back</button>
                    <button className="primary" onClick={submitSignature} disabled={phase === 'submitting'}>
                      {phase === 'submitting' ? 'Submitting…' : 'Sign & submit'}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="doc-preview-pane">
              <div className="doc-preview-sheet">
                {renderPreview()}
                {(phase === 'signing' || phase === 'submitting') && (
                  <>
                    <hr style={{ margin: '24px 0' }} />
                    {signatureType === 'typed' && typedName.trim() && (
                      <p style={{ fontFamily: 'cursive', fontSize: 26 }}>{typedName}</p>
                    )}
                    <p style={{ fontSize: 12, color: '#666' }}>
                      Signed electronically by {customerName} on {new Date().toLocaleDateString()}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {phase === 'done' && (
        <div className="center-pane">
          <h1>All done — thank you!</h1>
          <p>
            Your signed document has been recorded
            {confirmationRecorded ? ', along with your video confirmation' : ''}.
            You can close this page.
          </p>
          <div className="doc-actions" style={{ marginTop: 16, justifyContent: 'center' }}>
            {documentViewUrl && (
              <a href={documentViewUrl} target="_blank" rel="noreferrer">
                <button className="ghost">View document</button>
              </a>
            )}
            {documentUrl && (
              <a href={documentUrl}>
                <button className="primary">Download PDF</button>
              </a>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
    </main>
  );
}
