import { NextResponse } from 'next/server';
import { authenticateDocumentSessionToken, extractDocumentToken } from '@/lib/document-session-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { substituteDocumentVariables } from '@/lib/document-types';
import { logDocumentLifecycle, logAudit } from '@/lib/observability';
import { renderDocumentPdf } from '@/lib/document-pdf';

/**
 * POST /api/public/document-session/[id]/sign
 * Body: { token, correlation_id, variable_values, signature_type: 'typed'|'drawn',
 *         signature_value: string /* typed name, or a data: URL PNG for drawn *\/ }
 *
 * Final step: validates every required variable is present, renders the
 * document with values substituted, stores that snapshot (+ a drawn
 * signature image, if any) in Storage, and marks the session completed.
 * This is a one-way transition — once completed, the session is
 * immutable (see GET/POST both rejecting further edits once completed).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const auth = await authenticateDocumentSessionToken(params.id, extractDocumentToken(req, url, body));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;
  const correlationId = body.correlation_id ?? 'unknown';

  if (session.status === 'completed') {
    return NextResponse.json({ error: 'already_completed' }, { status: 409 });
  }

  const signatureType = body.signature_type;
  if (signatureType !== 'typed' && signatureType !== 'drawn') {
    return NextResponse.json({ error: 'signature_type must be "typed" or "drawn"' }, { status: 400 });
  }
  const signatureValue = typeof body.signature_value === 'string' ? body.signature_value.trim() : '';
  if (!signatureValue) {
    return NextResponse.json({ error: 'signature_value required' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: template } = await db
    .from('document_templates').select('name, body, variables').eq('id', session.document_template_id).single();
  if (!template) return NextResponse.json({ error: 'template_not_found' }, { status: 404 });

  const finalValues: Record<string, string> = {
    ...(session.variable_values ?? {}),
    ...(body.variable_values && typeof body.variable_values === 'object' ? body.variable_values : {}),
  };

  const missing = (template.variables as any[])
    .filter((v) => v.required && !finalValues[v.key])
    .map((v) => v.key);
  if (missing.length > 0) {
    return NextResponse.json({ error: `missing required fields: ${missing.join(', ')}` }, { status: 400 });
  }

  const filledBody = substituteDocumentVariables(template.body, finalValues);
  const signedAt = new Date().toISOString();

  // Drawn signatures arrive as a data: URL PNG; store the image separately
  // so the review page can render it, and reference it from the snapshot.
  let signatureStoragePath: string | null = null;
  let signatureImageBytes: Uint8Array | null = null;
  if (signatureType === 'drawn') {
    const match = signatureValue.match(/^data:image\/png;base64,(.+)$/);
    if (!match) return NextResponse.json({ error: 'signature_value must be a PNG data URL' }, { status: 400 });
    signatureImageBytes = new Uint8Array(Buffer.from(match[1], 'base64'));
    signatureStoragePath = `document-sessions/${session.id}/signature.png`;
    const { error: sigErr } = await db.storage
      .from('signed-documents').upload(signatureStoragePath, signatureImageBytes, { contentType: 'image/png', upsert: true });
    if (sigErr) return NextResponse.json({ error: `signature_upload_failed: ${sigErr.message}` }, { status: 500 });
  }

  const signedOnLabel = new Date(signedAt).toLocaleString();
  const signatureBlockHtml =
    signatureType === 'typed'
      ? `<p class="sig-name">${escapeHtml(signatureValue)}</p><p class="sig-meta">Signed electronically by ${escapeHtml(session.customer_name)} on ${signedOnLabel}</p>`
      : `<p class="sig-meta">Signed electronically by ${escapeHtml(session.customer_name)} on ${signedOnLabel}</p>`;

  // Styled for both on-screen viewing and the browser's own print-to-PDF —
  // fixed A4 page size + margins, generous line-height, and forced word
  // wrapping so nothing overlaps or runs off the page, on screen or on paper.
  const snapshotHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(template.name)}</title>
<style>
  * { box-sizing: border-box; }
  html { background: #6b7280; }
  body {
    font-family: Georgia, 'Times New Roman', serif; margin: 0; color: #1a1a1a;
    background: #6b7280;
  }
  .print-bar {
    position: sticky; top: 0; z-index: 10;
    display: flex; justify-content: center; gap: 10px;
    padding: 14px; background: #374151; box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  }
  .print-bar button {
    font: inherit; font-size: 14px; font-weight: 700; padding: 10px 22px; border-radius: 8px;
    border: none; background: #fff; color: #111; cursor: pointer;
  }
  .page {
    max-width: 794px; margin: 24px auto; background: #fff;
    padding: 64px 72px; box-shadow: 0 4px 18px rgba(0,0,0,0.25);
    line-height: 1.7; font-size: 14.5px;
  }
  .doc-title {
    font-size: 20px; font-weight: 700; text-align: center; margin: 0 0 28px;
    letter-spacing: 0.02em; text-transform: uppercase;
  }
  .doc-body {
    white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word;
  }
  .sig-block { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; }
  .sig-name { font-family: 'Brush Script MT', cursive; font-size: 30px; margin: 0 0 6px; }
  .sig-meta { font-size: 12.5px; color: #555; margin: 0; }
  @media print {
    html, body { background: #fff; }
    .print-bar { display: none; }
    .page { box-shadow: none; margin: 0; max-width: none; padding: 0; }
    @page { size: A4; margin: 22mm 20mm; }
  }
</style>
</head>
<body>
<div class="print-bar"><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="page">
  <h1 class="doc-title">${escapeHtml(template.name)}</h1>
  <div class="doc-body">${escapeHtml(filledBody)}</div>
  <div class="sig-block">${signatureBlockHtml}</div>
</div>
</body></html>`;

  const documentStoragePath = `document-sessions/${session.id}/signed.html`;
  const { error: docErr } = await db.storage
    .from('signed-documents')
    .upload(documentStoragePath, Buffer.from(snapshotHtml, 'utf-8'), { contentType: 'text/html', upsert: true });
  if (docErr) return NextResponse.json({ error: `document_upload_failed: ${docErr.message}` }, { status: 500 });

  // A real, directly-downloadable PDF — rendered server-side with pdf-lib
  // (no headless browser), so "Download PDF" hands over an actual .pdf
  // file instead of relying on the customer's browser print dialog.
  const pdfBytes = await renderDocumentPdf({
    title: template.name,
    body: filledBody,
    signatureType,
    typedSignature: signatureType === 'typed' ? signatureValue : null,
    signatureImageBytes,
    signerName: session.customer_name,
    signedOnLabel,
  });
  const pdfStoragePath = `document-sessions/${session.id}/signed.pdf`;
  const { error: pdfErr } = await db.storage
    .from('signed-documents')
    .upload(pdfStoragePath, pdfBytes, { contentType: 'application/pdf', upsert: true });
  if (pdfErr) return NextResponse.json({ error: `pdf_upload_failed: ${pdfErr.message}` }, { status: 500 });

  // The video confirmation clip (if any) is uploaded by the client AFTER
  // this call succeeds, then attached via the confirmation-video route
  // below — recording happens once signing is confirmed, not before.
  const { error: updateErr } = await db.from('document_sessions').update({
    variable_values: finalValues,
    status: 'completed',
    signature_type: signatureType,
    signature_data: signatureType === 'typed' ? signatureValue : signatureStoragePath,
    signed_document_path: documentStoragePath,
    signed_document_pdf_path: pdfStoragePath,
    signed_at: signedAt,
    completed_at: signedAt,
  }).eq('id', session.id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await logDocumentLifecycle({
    documentSessionId: session.id, correlationId, eventType: 'document.signed',
    data: { signature_type: signatureType },
  });
  await logAudit({
    action: 'document_session.signed', entityType: 'document_session', entityId: session.id,
    newValues: { signature_type: signatureType }, actorType: 'customer',
  });

  // /document/pdf hands back the real server-rendered PDF as a direct
  // file download; /document (HTML, inline) stays available as an
  // on-screen view with its own print button as a fallback.
  const documentUrl = `/api/public/document-session/${session.id}/document/pdf?token=${session.access_token}`;
  const documentViewUrl = `/api/public/document-session/${session.id}/document?token=${session.access_token}`;

  return NextResponse.json({ ok: true, document_url: documentUrl, document_view_url: documentViewUrl });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
