'use client';

/**
 * A minimal one-shot recorder for short confirmation clips (a few seconds),
 * as opposed to CallRecorder — which drives a canvas compositor and a
 * segmented upload queue built for long calls. This just records the raw
 * webcam+mic stream directly and hands back a single Blob.
 */
export class SimpleRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  start(stream: MediaStream) {
    this.chunks = [];
    const mime = pickMimeType();
    this.recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
  }

  /** Stops recording and resolves with the full clip as one Blob. */
  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.recorder || this.recorder.state === 'inactive') {
        resolve(new Blob(this.chunks, { type: 'video/webm' }));
        return;
      }
      this.recorder.onstop = () => resolve(new Blob(this.chunks, { type: this.recorder?.mimeType || 'video/webm' }));
      this.recorder.stop();
    });
  }
}

function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}
