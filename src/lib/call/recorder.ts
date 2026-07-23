'use client';

/**
 * Browser recorder (primary path).
 * A canvas compositor blends the customer's webcam, a picture-in-picture
 * question video, and text captions — all burned into the recorded pixels
 * LIVE at capture time (compliance: never reconstructed post-hoc).
 * MediaRecorder emits short segments (SEGMENT_MS) which are handed to the upload queue.
 */

// Small timeslice: MediaRecorder hands off a blob every few seconds instead of
// buffering up to 30s of unsaved footage. Shrinks the at-risk window on every
// platform, which matters most where Background Sync can't finish the job
// after tab-close (iOS Safari has no Background Sync API at all).
export const SEGMENT_MS = 4_000;
const W = 1280;
const H = 720;

export type CompositorHealth = {
  framesDrawn: number;
  pipActive: boolean;
  captionsActive: boolean;
  lastFrameAt: number;
};

export class CallRecorder {
  readonly takeId: string;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private webcamVideo: HTMLVideoElement;
  private questionVideo: HTMLVideoElement | null = null;
  private caption = '';
  private recorder: MediaRecorder | null = null;
  private rafId = 0;
  private segmentIndex = 0;
  private segmentStartedAt = 0;
  private stopped = false;
  private stream: MediaStream | null = null;

  health: CompositorHealth = { framesDrawn: 0, pipActive: false, captionsActive: false, lastFrameAt: 0 };

  /** Called with each finished segment blob. */
  onSegment: (blob: Blob, segmentIndex: number, durationMs: number) => void = () => {};
  /** Called if the recorder fails irrecoverably (triggers cloud fallback). */
  onFatalError: (reason: string) => void = () => {};

  constructor(webcamVideo: HTMLVideoElement, canvas: HTMLCanvasElement) {
    this.takeId = crypto.randomUUID(); // one recorder spawn = one take
    this.webcamVideo = webcamVideo;
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas_2d_unavailable');
    this.ctx = ctx;
  }

  setQuestionVideo(el: HTMLVideoElement | null) { this.questionVideo = el; }
  setCaption(text: string) { this.caption = text; }

  start(webcamStream: MediaStream) {
    try {
      this.drawLoop();

      const canvasStream = this.canvas.captureStream(30);
      const audioTracks = webcamStream.getAudioTracks();
      this.stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

      const mime = pickMimeType();
      this.recorder = new MediaRecorder(this.stream, {
        mimeType: mime,
        videoBitsPerSecond: 2_500_000,
      });
      this.segmentStartedAt = performance.now();
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          const duration = Math.round(performance.now() - this.segmentStartedAt);
          this.segmentStartedAt = performance.now();
          this.onSegment(e.data, this.segmentIndex++, duration);
        }
      };
      this.recorder.onerror = () => this.fail('media_recorder_error');
      this.recorder.start(SEGMENT_MS); // 30-second segments, continuously
    } catch (e: any) {
      this.fail(e?.message ?? 'recorder_start_failed');
    }
  }

  /** Flush the in-progress segment now (used after each answered question). */
  flush() {
    if (this.recorder && this.recorder.state === 'recording') {
      try { this.recorder.requestData(); } catch { /* best-effort */ }
    }
  }

  /** Stop recording; final ondataavailable fires with the last partial segment. */
  stop(): Promise<number> {
    return new Promise((resolve) => {
      this.stopped = true;
      cancelAnimationFrame(this.rafId);
      if (!this.recorder || this.recorder.state === 'inactive') {
        resolve(this.segmentIndex);
        return;
      }
      this.recorder.onstop = () => resolve(this.segmentIndex);
      try { this.recorder.stop(); } catch { resolve(this.segmentIndex); }
    });
  }

  get expectedSegmentCount() { return this.segmentIndex; }

  private fail(reason: string) {
    if (this.stopped) return;
    this.stopped = true;
    cancelAnimationFrame(this.rafId);
    this.onFatalError(reason);
  }

  private drawLoop = () => {
    if (this.stopped) return;
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = '#0D1B2A';
    ctx.fillRect(0, 0, W, H);

    // Webcam, full frame (cover)
    if (this.webcamVideo.readyState >= 2) {
      drawCover(ctx, this.webcamVideo, 0, 0, W, H);
    }

    // Question video PiP, top-right
    const pip = this.questionVideo;
    const pipActive = !!pip && pip.readyState >= 2 && !pip.ended;
    if (pipActive && pip) {
      const pw = 320, ph = 180, px = W - pw - 24, py = 24;
      ctx.save();
      ctx.strokeStyle = '#00C2D4';
      ctx.lineWidth = 3;
      ctx.strokeRect(px - 2, py - 2, pw + 4, ph + 4);
      drawCover(ctx, pip, px, py, pw, ph);
      ctx.restore();
    }

    // Caption bar, bottom — burned into pixels
    const captionsActive = this.caption.length > 0;
    if (captionsActive) {
      ctx.save();
      ctx.fillStyle = 'rgba(13,27,42,0.82)';
      ctx.fillRect(0, H - 96, W, 96);
      ctx.fillStyle = '#F0F4F8';
      ctx.font = '600 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      wrapText(ctx, this.caption, W / 2, H - 48, W - 120, 32);
      ctx.restore();
    }

    // Timestamp watermark (compliance)
    ctx.save();
    ctx.fillStyle = 'rgba(240,244,248,0.7)';
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(new Date().toISOString(), 16, 28);
    ctx.restore();

    this.health.framesDrawn++;
    this.health.pipActive = pipActive;
    this.health.captionsActive = captionsActive;
    this.health.lastFrameAt = Date.now();

    this.rafId = requestAnimationFrame(this.drawLoop);
  };
}

function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4', // Safari
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

function drawCover(
  ctx: CanvasRenderingContext2D, video: HTMLVideoElement,
  x: number, y: number, w: number, h: number
) {
  const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
  const scale = Math.max(w / vw, h / vh);
  const sw = w / scale, sh = h / scale;
  const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
  ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h);
}

function wrapText(
  ctx: CanvasRenderingContext2D, text: string,
  cx: number, cy: number, maxWidth: number, lineHeight: number
) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));
}
