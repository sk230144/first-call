'use client';

/**
 * Browser-native voice I/O for the call flow.
 * TTS: speaks the current question aloud (speechSynthesis plays through the
 * device speaker; since the mic is already being recorded, the spoken
 * question is picked up ambiently into the same take — no separate audio
 * pipeline needed).
 * STT: transcribes the customer's spoken answer into text so it can ride
 * along with the yes/no button press into session_answers.transcript.
 */

export function speakQuestion(text: string, language?: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel(); // don't overlap with a previous question
  const utterance = new SpeechSynthesisUtterance(text);
  if (language) utterance.lang = language;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export const isSpeechRecognitionSupported =
  typeof window !== 'undefined' &&
  !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

/**
 * Listens continuously and reports the best-guess transcript as it updates.
 * Not supported in Firefox/Safari — callers should treat transcript as
 * best-effort and never block the answer flow on it.
 */
export class AnswerTranscriber {
  private recognition: SpeechRecognitionLike | null = null;
  private transcript = '';

  onUpdate: (transcript: string) => void = () => {};

  start(language?: string) {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    this.transcript = '';
    const recognition: SpeechRecognitionLike = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    if (language) recognition.lang = language;
    recognition.onresult = (event: any) => {
      let finalText = '';
      for (let i = 0; i < event.results.length; i++) {
        finalText += event.results[i][0].transcript;
      }
      this.transcript = finalText.trim();
      this.onUpdate(this.transcript);
    };
    recognition.onerror = () => { /* best-effort: keep whatever we already have */ };
    recognition.onend = () => {
      // Some browsers auto-stop after a pause; restart to keep listening
      // for the current question unless we've been explicitly stopped.
      if (this.recognition === recognition) {
        try { recognition.start(); } catch { /* already stopped */ }
      }
    };
    this.recognition = recognition;
    try { recognition.start(); } catch { /* mic not ready yet */ }
  }

  /** Stop listening and return whatever transcript was captured. */
  stop(): string {
    const r = this.recognition;
    this.recognition = null;
    if (r) {
      r.onend = null;
      try { r.stop(); } catch { /* already stopped */ }
    }
    return this.transcript;
  }

  reset() {
    this.transcript = '';
  }
}
