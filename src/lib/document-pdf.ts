import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

/**
 * Renders the signed agreement as a real PDF file (server-side, no headless
 * browser) — pdf-lib draws the PDF directly, which keeps this cheap and
 * reliable on Vercel's serverless functions. A4 page, wrapped body text,
 * automatic pagination, and a signature block at the end.
 */
export async function renderDocumentPdf(opts: {
  title: string;
  body: string;
  signatureType: 'typed' | 'drawn';
  typedSignature: string | null;
  signatureImageBytes: Uint8Array | null;
  signerName: string;
  signedOnLabel: string;
}): Promise<Uint8Array> {
  const { title, body, signatureType, typedSignature, signatureImageBytes, signerName, signedOnLabel } = opts;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italicFont = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const PAGE_W = 595.28; // A4 at 72dpi
  const PAGE_H = 841.89;
  const MARGIN = 64;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const BODY_SIZE = 11;
  const LINE_HEIGHT = 16;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let cursorY = PAGE_H - MARGIN;

  function newPage() {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    cursorY = PAGE_H - MARGIN;
  }

  function ensureSpace(height: number) {
    if (cursorY - height < MARGIN) newPage();
  }

  function drawWrappedText(text: string, size: number, useFont: PDFFont, color = rgb(0.1, 0.1, 0.1)) {
    const paragraphs = text.split('\n');
    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        ensureSpace(LINE_HEIGHT);
        cursorY -= LINE_HEIGHT;
        continue;
      }
      const words = paragraph.split(/\s+/).filter(Boolean);
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        const width = useFont.widthOfTextAtSize(candidate, size);
        if (width > CONTENT_W && line) {
          ensureSpace(LINE_HEIGHT);
          page.drawText(line, { x: MARGIN, y: cursorY, size, font: useFont, color });
          cursorY -= LINE_HEIGHT;
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) {
        ensureSpace(LINE_HEIGHT);
        page.drawText(line, { x: MARGIN, y: cursorY, size, font: useFont, color });
        cursorY -= LINE_HEIGHT;
      }
    }
  }

  // ---- Title ----
  const titleSize = 16;
  const titleWidth = boldFont.widthOfTextAtSize(title.toUpperCase(), titleSize);
  page.drawText(title.toUpperCase(), {
    x: (PAGE_W - titleWidth) / 2, y: cursorY, size: titleSize, font: boldFont, color: rgb(0, 0, 0),
  });
  cursorY -= titleSize + 24;

  // ---- Body ----
  drawWrappedText(body, BODY_SIZE, font);

  // ---- Signature block ----
  cursorY -= 20;
  ensureSpace(90);
  page.drawLine({
    start: { x: MARGIN, y: cursorY }, end: { x: PAGE_W - MARGIN, y: cursorY },
    thickness: 0.75, color: rgb(0.7, 0.7, 0.7),
  });
  cursorY -= 20;

  if (signatureType === 'typed' && typedSignature) {
    ensureSpace(34);
    page.drawText(typedSignature, { x: MARGIN, y: cursorY, size: 22, font: italicFont, color: rgb(0.05, 0.05, 0.05) });
    cursorY -= 30;
  } else if (signatureType === 'drawn' && signatureImageBytes) {
    try {
      const img = await pdf.embedPng(signatureImageBytes);
      const maxW = 180;
      const scale = Math.min(1, maxW / img.width);
      const w = img.width * scale;
      const h = img.height * scale;
      ensureSpace(h + 10);
      page.drawImage(img, { x: MARGIN, y: cursorY - h, width: w, height: h });
      cursorY -= h + 10;
    } catch {
      // If the signature image can't be embedded, fall through to the text line below.
    }
  }

  ensureSpace(LINE_HEIGHT);
  page.drawText(`Signed electronically by ${signerName} on ${signedOnLabel}`, {
    x: MARGIN, y: cursorY, size: 10, font, color: rgb(0.35, 0.35, 0.35),
  });

  return pdf.save();
}
