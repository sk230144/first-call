'use client';

/**
 * Customer call page — /session/[id]?token=...
 * State machine: loading → consent → setup → recording → finalizing → done
 * No login: the token in the URL is the only credential.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CallRecorder } from '@/lib/call/recorder';
import { UploadQueue, registerBackgroundSync } from '@/lib/call/uploadQueue';
import { AnswerTranscriber, isSpeechRecognitionSupported, speakQuestion, stopSpeaking } from '@/lib/call/voice';

type Question = { id: string; order: number; text: string; video_url: string | null };
type Payload = {
  session: { id: string; status: string; customer_name: string; consent_at: string | null };
  template: { language: string; recording_mode: string; consent_language: string };
  questions: Question[];
  answered: { question_id: string; answer: string }[];
};

type Phase = 'loading' | 'error' | 'consent' | 'setup' | 'recording' | 'finalizing' | 'done';

const CALL_PAGE_CSS = `
        .call-page {
          min-height: 100vh; color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          background: radial-gradient(1100px 500px at 15% -10%, rgba(0,194,212,0.10), transparent 60%), #0a1420;
        }
        .badge-mark {
          display: inline-flex; align-items: center; justify-content: center;
          width: 48px; height: 48px; border-radius: 14px; margin-bottom: 20px;
          font-weight: 800; font-size: 18px; color: #06282c;
          background: linear-gradient(135deg, #22d8ea, #00c2d4);
          box-shadow: 0 6px 20px rgba(0,194,212,0.35);
        }
        .badge-mark.done { background: linear-gradient(135deg, #4ade80, #22c55e); box-shadow: 0 6px 20px rgba(34,197,94,0.35); }
        .spinner {
          width: 32px; height: 32px; border-radius: 50%; margin-bottom: 16px;
          border: 3px solid rgba(0,194,212,0.2); border-top-color: #00c2d4;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .stage { display: flex; flex-direction: column; align-items: center; padding: 24px; gap: 16px; }
        .composite { width: min(960px, 100%); border-radius: 14px; border: 1px solid #223d5e; box-shadow: 0 8px 28px rgba(0,0,0,0.35); }
        .controls { text-align: center; max-width: 720px; width: 100%; }
        .progress-track { width: 100%; max-width: 320px; height: 4px; border-radius: 100px; background: #1a3350; margin: 0 auto 12px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #00c2d4, #22d8ea); transition: width 0.3s ease; border-radius: 100px; }
        .progress { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #8ba4b8; margin-bottom: 8px; font-weight: 600; }
        .question-text { font-size: 21px; font-weight: 600; margin-bottom: 18px; letter-spacing: -0.01em; }
        .listening-hint { font-size: 13px; color: #8ba4b8; margin: -10px 0 18px; }
        .answer-row { display: flex; gap: 16px; justify-content: center; }
        .btn-yes, .btn-no, .btn-primary {
          font-size: 16px; font-weight: 700; padding: 13px 52px; border-radius: 10px; border: none; cursor: pointer;
          transition: transform 0.08s ease, filter 0.15s ease, box-shadow 0.15s ease;
        }
        .btn-yes:active, .btn-no:active, .btn-primary:active { transform: translateY(1px); }
        .btn-yes:hover, .btn-no:hover, .btn-primary:hover { filter: brightness(1.08); }
        .btn-yes { background: #22c55e; color: #06240f; box-shadow: 0 4px 16px rgba(34,197,94,0.3); }
        .btn-no { background: #ef4444; color: #2a0505; box-shadow: 0 4px 16px rgba(239,68,68,0.3); }
        .btn-primary { background: linear-gradient(135deg, #22d8ea, #00c2d4); color: #06282c; margin-top: 20px; box-shadow: 0 4px 16px rgba(0,194,212,0.3); }
        .rec-dot { margin-top: 18px; color: #ef4444; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; }
        .consent-text { background: #142943; border: 1px solid #223d5e; border-radius: 10px; padding: 18px; margin: 18px 0; line-height: 1.6; }
        .muted { color: #8ba4b8; font-size: 14px; }
      `;

export default function SessionCallPage() {
  const { id } = useParams<{ id: string }>();
  const token = useSearchParams().get('token');

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [payload, setPayload] = useState<Payload | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [uploadsPending, setUploadsPending] = useState(0);
  const [fallbackActive, setFallbackActive] = useState(false);

  const webcamRef = useRef<HTMLVideoElement>(null);
  const questionVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recorderRef = useRef<CallRecorder | null>(null);
  const queueRef = useRef<UploadQueue | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const correlationId = useRef<string>('');
  const transcriberRef = useRef<AnswerTranscriber | null>(null);
  const liveTranscriptRef = useRef('');

  // ---------- helpers ----------
  const api = useCallback(
    (path: string, body: Record<string, unknown> = {}) =>
      fetch(`/api/public/session/${id}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, correlation_id: correlationId.current, ...body }),
      }),
    [id, token]
  );

  const telemetry = useCallback(
    (event_type: string, event_data: Record<string, unknown> = {}) => {
      void api('/event', { event_type, event_data: { ...event_data, correlation_id: correlationId.current } });
    },
    [api]
  );

  // ---------- load payload + register service worker ----------
  useEffect(() => {
    correlationId.current = crypto.randomUUID();
    if (!token) { setPhase('error'); setErrorMsg('This link is missing its access token.'); return; }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    fetch(`/api/public/session/${id}?token=${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setErrorMsg(
            data.error === 'session_expired' ? 'This link has expired. Please contact your representative for a new one.' :
            data.error === 'already_completed' ? 'This welcome call has already been completed. Thank you!' :
            'This link is invalid. Please contact your representative.'
          );
          setPhase('error');
          return;
        }
        setPayload(data);
        setPhase('consent');
      })
      .catch(() => { setErrorMsg('Could not reach the server. Please check your connection.'); setPhase('error'); });
  }, [id, token]);

  // ---------- consent ----------
  async function giveConsent() {
    setPhase('setup');
    let location: unknown = null;
    try {
      location = await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null), // best-effort
          { timeout: 5000 }
        );
      });
    } catch { /* best-effort */ }
    await api('/consent', {
      location,
      device_info: { platform: navigator.platform, language: navigator.language },
    });
    await startRecording();
  }

  // ---------- start recording ----------
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      const webcam = webcamRef.current!;
      webcam.srcObject = stream;
      await webcam.play();

      const queue = new UploadQueue();
      await queue.init();
      queue.onProgress = (pending) => setUploadsPending(pending);
      queueRef.current = queue;
      void queue.drain(); // resume anything left from a previous take (page refresh)

      const recorder = new CallRecorder(webcam, canvasRef.current!);
      recorder.setQuestionVideo(questionVideoRef.current);
      recorder.onSegment = (blob, segmentIndex, durationMs) => {
        void queue.enqueue({
          sessionId: id, token: token!, takeId: recorder.takeId,
          segmentIndex, kind: 'segment', blob, durationMs,
          correlationId: correlationId.current,
        });
        void registerBackgroundSync(); // blob is durable before the tab can close
      };
      recorder.onFatalError = (reason) => {
        // Cloud recorder fallback: signal the server; customer sees nothing different.
        setFallbackActive(true);
        telemetry('recorder_error', { reason });
        void api('/event', { event_type: 'fallback_requested', event_data: { reason } });
      };
      recorderRef.current = recorder;
      recorder.start(stream);

      // Fallback watchdog: if no segment/frame within first 60s, request cloud recorder
      setTimeout(() => {
        const r = recorderRef.current;
        if (r && r.health.framesDrawn < 30) r.onFatalError('no_frames_in_60s');
      }, 60_000);

      await api('', {}); // mark session active
      telemetry('call_started', { take_id: recorder.takeId });
      setPhase('recording');
      setQuestionIdx(0);
    } catch (e: any) {
      setErrorMsg(getMediaErrorMessage(e));
      setPhase('error');
      telemetry('permission_denied', { name: e?.name, message: e?.message });
    }
  }

  // ---------- question flow ----------
  const questions = payload?.questions ?? [];
  const currentQuestion = questions[questionIdx] ?? null;

  // keep compositor caption + PiP video in sync with current question
  useEffect(() => {
    const r = recorderRef.current;
    if (!r || phase !== 'recording') return;
    r.setCaption(currentQuestion?.text ?? '');
    const qv = questionVideoRef.current;
    if (qv && currentQuestion?.video_url) {
      qv.src = currentQuestion.video_url;
      qv.play().catch(() => {});
      r.setQuestionVideo(qv);
    } else {
      r.setQuestionVideo(null);
    }
    // compositor health telemetry per question
    telemetry('compositor_health', { ...r.health, question_id: currentQuestion?.id });
  }, [phase, questionIdx, currentQuestion, telemetry]);

  // speak the question aloud, then listen for the spoken answer — both are
  // best-effort: the mic already being recorded picks up the TTS audio
  // ambiently, and the transcript rides along with the yes/no button press.
  useEffect(() => {
    if (phase !== 'recording' || !currentQuestion) return;
    liveTranscriptRef.current = '';
    speakQuestion(currentQuestion.text, payload?.template.language);

    const transcriber = new AnswerTranscriber();
    transcriber.onUpdate = (t) => { liveTranscriptRef.current = t; };
    transcriber.start(payload?.template.language);
    transcriberRef.current = transcriber;

    return () => {
      transcriberRef.current = null;
      transcriber.stop();
    };
  }, [phase, currentQuestion, payload]);

  // Warn before leaving while segments are still uploading — the queue survives
  // a refresh/close via IndexedDB + Background Sync, but not every browser
  // supports Background Sync (notably iOS Safari), so this is the safety net
  // that stops the tab from closing mid-upload in the first place.
  useEffect(() => {
    const shouldWarn = () =>
      (phase === 'recording' || phase === 'finalizing') && uploadsPending > 0;
    const handler = (e: BeforeUnloadEvent) => {
      if (!shouldWarn()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase, uploadsPending]);

  async function answer(value: 'yes' | 'no') {
    if (!currentQuestion) return;
    stopSpeaking();
    const transcript = transcriberRef.current?.stop() || liveTranscriptRef.current || null;
    // Answer saved IMMEDIATELY — not at the end
    await api('/answer', { question_id: currentQuestion.id, answer: value, transcript });
    recorderRef.current?.flush(); // snapshot: flush current segment as backup
    if (questionIdx + 1 < questions.length) {
      setQuestionIdx(questionIdx + 1);
    } else {
      await finishCall();
    }
  }

  // ---------- finish: stop → wait for queue → settled barrier ----------
  async function finishCall() {
    setPhase('finalizing');
    stopSpeaking();
    transcriberRef.current?.stop();
    const recorder = recorderRef.current!;
    const queue = queueRef.current!;
    recorder.setCaption('');

    const expectedSegments = await recorder.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    await registerBackgroundSync();
    await queue.drain(); // push remaining segments now, while the tab is open

    const res = await api('/complete', {
      expected_segment_count: expectedSegments,
      recorder_source: fallbackActive ? 'cloud' : 'browser',
    });
    const data = await res.json().catch(() => ({}));
    telemetry('call_completed', { expected_segments: expectedSegments, assembly_status: data.assembly_status });
    setPhase('done');
  }

  // ---------- render ----------
  return (
    <main className="call-page">
      {/* hidden media elements feeding the compositor — always mounted so refs exist before recording starts */}
      <video ref={webcamRef} muted playsInline style={{ display: 'none' }} />
      <video ref={questionVideoRef} playsInline style={{ display: 'none' }} />

      {phase === 'loading' && <Center><p>Loading your welcome call…</p></Center>}

      {phase === 'error' && (
        <Center>
          <h1>Unable to start</h1>
          <p>{errorMsg}</p>
        </Center>
      )}

      {phase === 'consent' && payload && (
        <Center>
          <span className="badge-mark">WC</span>
          <h1>Welcome, {payload.session.customer_name}</h1>
          <p className="muted">You&apos;ll answer {questions.length} short questions on camera. It takes about 5 minutes.</p>
          <p className="consent-text">{payload.template.consent_language}</p>
          <button className="btn-primary" onClick={giveConsent}>I consent — start my call</button>
        </Center>
      )}

      {phase === 'setup' && (
        <Center>
          <div className="spinner" />
          <p>Setting up your camera and microphone…</p>
        </Center>
      )}

      <div className="stage" style={phase === 'recording' || phase === 'finalizing' ? undefined : { display: 'none' }}>
        <canvas ref={canvasRef} className="composite" />
        {phase === 'recording' && currentQuestion && (
          <div className="controls">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${((questionIdx + 1) / Math.max(questions.length, 1)) * 100}%` }} />
            </div>
            <div className="progress">Question {questionIdx + 1} of {questions.length}</div>
            <div className="question-text">{currentQuestion.text}</div>
            {isSpeechRecognitionSupported && <div className="listening-hint">🎙 Listening — you can also just say your answer</div>}
            <div className="answer-row">
              <button className="btn-yes" onClick={() => answer('yes')}>Yes</button>
              <button className="btn-no" onClick={() => answer('no')}>No</button>
            </div>
            <div className="rec-dot">● REC{uploadsPending > 0 ? ` · uploading ${uploadsPending}` : ''}</div>
          </div>
        )}
        {phase === 'finalizing' && (
          <div className="controls">
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <div className="question-text">Saving your recording… please keep this page open.</div>
            {uploadsPending > 0 && <div className="muted">{uploadsPending} segment(s) remaining</div>}
          </div>
        )}
      </div>

      {phase === 'done' && (
        <Center>
          <span className="badge-mark done">✓</span>
          <h1>All done — thank you!</h1>
          <p>Your welcome call has been recorded and submitted. You can close this page.</p>
        </Center>
      )}

      {/* dangerouslySetInnerHTML, not a text child: React escapes quotes inside
          a <style> text child on the server (&quot;) but not on the client,
          which trips a hydration mismatch. Raw HTML is emitted identically by both. */}
      <style dangerouslySetInnerHTML={{ __html: CALL_PAGE_CSS }} />
    </main>
  );
}

function getMediaErrorMessage(e: any): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'This page must be opened over a secure (https://) connection to use your camera and microphone.';
  }
  switch (e?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera and microphone access is required for this call. Please allow access in your browser settings and reload.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera or microphone was found on this device. Please connect one and reload.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your camera or microphone is already in use by another application. Please close it and reload.';
    case 'OverconstrainedError':
      return 'Your camera does not support the required video settings. Please try a different device.';
    default:
      return 'Camera and microphone access is required for this call. Please allow access and reload.';
  }
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: 24, maxWidth: 560, margin: '0 auto',
    }}>
      {children}
    </div>
  );
}
