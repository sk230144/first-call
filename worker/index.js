/**
 * Stitch worker — Phase 5.
 * - Polls stitch_jobs: take isolation → FFmpeg concat → validation gate → video_url.
 * - Settles deferred sessions (settled barrier retry).
 * - Drains the webhook outbox with retries + HMAC signatures.
 * - Nightly reconciliation re-validates the past 24h of completed sessions.
 * - Expires stale pending sessions.
 *
 * Requires ffmpeg + ffprobe on PATH.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WEBHOOK_SIGNING_SECRET, POLL_INTERVAL_MS
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const exec = promisify(execFile);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const POLL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5000);
const MIN_FINAL_BYTES = 100_000;            // validation gate: minimum file size
const DURATION_TOLERANCE = 0.8;             // final must be >= 80% of expected duration
const DEFERRED_TIMEOUT_MS = 15 * 60 * 1000; // awaiting_segments older than this → flagged

// ---------------------------------------------------------------- utilities

function log(sessionId, correlationId, eventType, severity = 'info', data = {}) {
  console.log(`[${severity}] ${eventType}`, sessionId ?? '', JSON.stringify(data));
  return db.from('recording_lifecycle_events').insert({
    session_id: sessionId, correlation_id: correlationId,
    event_type: eventType, severity, data,
  });
}

function audit(action, entityId, newValues = null) {
  return db.from('audit_logs').insert({
    action, entity_type: 'session', entity_id: entityId,
    new_values: newValues, actor_type: 'system',
  });
}

async function ffprobeDuration(file) {
  const { stdout } = await exec('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ]);
  return Math.round(parseFloat(stdout.trim()) * 1000); // ms
}

// ---------------------------------------------------------------- stitching

async function claimNextJob() {
  const { data: jobs } = await db.from('stitch_jobs')
    .select('*').eq('status', 'queued').order('created_at').limit(1);
  if (!jobs || jobs.length === 0) return null;
  const job = jobs[0];
  const { data: claimed } = await db.from('stitch_jobs')
    .update({ status: 'processing', attempts: job.attempts + 1 })
    .eq('id', job.id).eq('status', 'queued') // optimistic lock
    .select();
  return claimed && claimed.length > 0 ? claimed[0] : null;
}

async function processJob(job) {
  const correlationId = crypto.randomUUID();
  const sessionId = job.session_id;
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), `stitch-${sessionId.slice(0, 8)}-`));

  try {
    await log(sessionId, correlationId, 'stitch.started', 'info', { job_id: job.id, attempt: job.attempts });

    const { data: segments } = await db.from('session_segments')
      .select('*').eq('session_id', sessionId)
      .order('created_at', { ascending: true }).order('segment_index', { ascending: true });
    if (!segments || segments.length === 0) throw new StitchError('missing', 'no_segments_registered');

    // ---- Take isolation: group segments by take, order takes by first-seen ----
    const takes = new Map();
    for (const seg of segments) {
      if (!takes.has(seg.take_id)) takes.set(seg.take_id, []);
      takes.get(seg.take_id).push(seg);
    }
    const orderedTakes = [...takes.entries()]; // insertion order = call order
    await log(sessionId, correlationId, 'stitch.takes_isolated', 'info', {
      take_count: orderedTakes.length,
      takes: orderedTakes.map(([id, segs]) => ({ take_id: id, segments: segs.length })),
    });

    // ---- Per take: download segments in order, binary-concat, remux to mp4 ----
    // MediaRecorder timeslice blobs are only valid when concatenated in order
    // within their own take — takes are NEVER mixed randomly.
    const takeFiles = [];
    let expectedDurationMs = 0;
    for (const [takeId, segs] of orderedTakes) {
      segs.sort((a, b) => a.segment_index - b.segment_index);
      const rawPath = path.join(tmp, `take-${takeFiles.length}.webm`);
      const handle = await fs.open(rawPath, 'w');
      for (const seg of segs) {
        const { data: blob, error } = await db.storage.from('recordings').download(seg.storage_path);
        if (error) throw new StitchError('missing', `segment_download_failed:${seg.storage_path}`);
        await handle.write(Buffer.from(await blob.arrayBuffer()));
        expectedDurationMs += seg.duration_ms ?? 0;
      }
      await handle.close();

      const mp4Path = path.join(tmp, `take-${takeFiles.length}.mp4`);
      await exec('ffmpeg', [
        '-y', '-i', rawPath,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-c:a', 'aac', '-movflags', '+faststart', mp4Path,
      ]);
      takeFiles.push(mp4Path);
    }

    // ---- Concatenate takes in call order ----
    let finalPath;
    if (takeFiles.length === 1) {
      finalPath = takeFiles[0];
    } else {
      const listPath = path.join(tmp, 'concat.txt');
      await fs.writeFile(listPath, takeFiles.map((f) => `file '${f}'`).join('\n'));
      finalPath = path.join(tmp, 'final.mp4');
      await exec('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', finalPath]);
    }

    // ---- Output validation gate ----
    const stat = await fs.stat(finalPath);
    const durationMs = await ffprobeDuration(finalPath);
    const verdict = validateOutput(stat.size, durationMs, expectedDurationMs);
    await log(sessionId, correlationId, 'stitch.gate_verdict', verdict.ok ? 'info' : 'error', {
      size_bytes: stat.size, duration_ms: durationMs,
      expected_duration_ms: expectedDurationMs, verdict,
    });
    if (!verdict.ok) throw new StitchError(verdict.reason, 'validation_gate_failed');

    // ---- Upload final video, write session_takes, mark session complete ----
    const storagePath = `sessions/${sessionId}/final.mp4`;
    const fileBuf = await fs.readFile(finalPath);
    const { error: upErr } = await db.storage.from('recordings')
      .upload(storagePath, fileBuf, { contentType: 'video/mp4', upsert: true }); // idempotent
    if (upErr) throw new StitchError('missing', `final_upload_failed:${upErr.message}`);

    await db.from('session_takes').insert({
      session_id: sessionId, take_index: 0, storage_path: storagePath,
      is_stitched: true, source: 'browser',
      duration_ms: durationMs, size_bytes: stat.size,
    });

    const { data: session } = await db.from('sessions').select('recovery_state, template_id').eq('id', sessionId).single();
    await db.from('sessions').update({
      video_url: storagePath,
      video_duration_ms: durationMs,
      assembly_status: 'done',
      status: 'completed',
      completed_at: new Date().toISOString(),
      ...(session?.recovery_state === 'in_recovery' ? { recovery_state: 'resolved' } : {}),
    }).eq('id', sessionId);
    await db.from('stitch_jobs').update({ status: 'done' }).eq('id', job.id);

    await audit('session.assembly_completed', sessionId, { video_url: storagePath, duration_ms: durationMs });
    await log(sessionId, correlationId, 'stitch.completed', 'info', { storage_path: storagePath });

    // ---- Webhook on completion ----
    const { data: template } = await db.from('templates').select('webhook_url').eq('id', session?.template_id).single();
    if (template?.webhook_url) {
      const { data: answers } = await db.from('session_answers')
        .select('question_id, answer, answered_at').eq('session_id', sessionId);
      await db.from('webhook_deliveries').insert({
        session_id: sessionId, url: template.webhook_url, event: 'completed',
        payload: { session_id: sessionId, video_url: storagePath, duration_ms: durationMs, answers },
      });
    }
  } catch (err) {
    const reason = err instanceof StitchError ? err.reason : 'corrupt';
    const message = err?.message ?? String(err);
    await log(sessionId, correlationId, 'stitch.failed', 'error', { reason, message, attempt: job.attempts });

    if (job.attempts >= job.max_attempts) {
      // Route to human recovery queue — never a silent failure
      await db.from('stitch_jobs').update({ status: 'failed', last_error: message }).eq('id', job.id);
      await db.from('sessions').update({
        assembly_status: 'failed', recovery_state: 'flagged', recovery_reason: reason,
      }).eq('id', sessionId);
      await audit('session.flagged_for_recovery', sessionId, { reason, message });
    } else {
      await db.from('stitch_jobs').update({ status: 'queued', last_error: message }).eq('id', job.id);
    }
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

class StitchError extends Error {
  constructor(reason, message) { super(message); this.reason = reason; } // corrupt | too_short | missing | cut_off
}

function validateOutput(sizeBytes, durationMs, expectedDurationMs) {
  if (sizeBytes < MIN_FINAL_BYTES) return { ok: false, reason: 'too_short' };
  if (!durationMs || Number.isNaN(durationMs)) return { ok: false, reason: 'corrupt' };
  if (expectedDurationMs > 0 && durationMs < expectedDurationMs * DURATION_TOLERANCE) {
    return { ok: false, reason: 'cut_off' };
  }
  return { ok: true };
}

// ------------------------------------------------- deferred settled barrier

async function settleDeferredSessions() {
  const { data: sessions } = await db.from('sessions')
    .select('id, expected_segment_count, updated_at')
    .eq('assembly_status', 'awaiting_segments').limit(50);
  for (const s of sessions ?? []) {
    const { count } = await db.from('session_segments')
      .select('id', { count: 'exact', head: true }).eq('session_id', s.id);
    const correlationId = crypto.randomUUID();
    if ((count ?? 0) >= s.expected_segment_count) {
      await db.from('sessions').update({ assembly_status: 'queued' }).eq('id', s.id);
      await db.from('stitch_jobs').insert({ session_id: s.id });
      await log(s.id, correlationId, 'barrier.settled_by_cron', 'info', { registered: count });
    } else if (Date.now() - new Date(s.updated_at).getTime() > DEFERRED_TIMEOUT_MS) {
      // Segments never arrived (browser gone, sync failed) → human recovery
      await db.from('sessions').update({
        assembly_status: 'failed', recovery_state: 'flagged', recovery_reason: 'missing',
      }).eq('id', s.id);
      await log(s.id, correlationId, 'barrier.timed_out', 'error', {
        registered: count, expected: s.expected_segment_count,
      });
    }
  }
}

// ------------------------------------------------------------ webhook outbox

function sign(body) {
  return crypto.createHmac('sha256', process.env.WEBHOOK_SIGNING_SECRET || '').update(body).digest('hex');
}

async function drainWebhooks() {
  const { data: deliveries } = await db.from('webhook_deliveries')
    .select('*').eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString()).limit(20);
  for (const d of deliveries ?? []) {
    const body = JSON.stringify({ event: d.event, data: d.payload });
    let ok = false, error = '';
    try {
      const res = await fetch(d.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': sign(body),
          'X-Webhook-Event': d.event,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      ok = res.ok;
      if (!ok) error = `http_${res.status}`;
    } catch (e) { error = e?.message ?? 'network_error'; }

    if (ok) {
      await db.from('webhook_deliveries').update({ status: 'delivered', attempts: d.attempts + 1 }).eq('id', d.id);
    } else {
      const attempts = d.attempts + 1;
      const giveUp = attempts >= 8;
      await db.from('webhook_deliveries').update({
        status: giveUp ? 'failed' : 'pending',
        attempts, last_error: error,
        next_attempt_at: new Date(Date.now() + Math.min(60_000 * 2 ** attempts, 6 * 3600_000)).toISOString(),
      }).eq('id', d.id);
    }
  }
}

// ------------------------------------------------------ nightly reconciliation

let lastReconcileDate = '';

async function nightlyReconciliation() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (now.getUTCHours() !== 3 || lastReconcileDate === today) return;
  lastReconcileDate = today;

  const correlationId = crypto.randomUUID();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: sessions } = await db.from('sessions')
    .select('id, video_url, video_duration_ms, expected_segment_count, recovery_state, recorder_source')
    .in('status', ['completed', 'approved'])
    .gte('completed_at', since);

  for (const s of sessions ?? []) {
    if (s.recovery_state !== 'none' && s.recovery_state !== 'resolved') continue; // never stomp in-recovery
    if (s.recorder_source === 'cloud') continue;                                   // graded separately

    let reason = null;
    if (!s.video_url) reason = 'missing';
    else {
      const { data: blob, error } = await db.storage.from('recordings').download(s.video_url);
      if (error || !blob) reason = 'missing';
      else if (blob.size < MIN_FINAL_BYTES) reason = 'too_short';
    }
    if (reason) {
      await db.from('sessions').update({ recovery_state: 'flagged', recovery_reason: reason }).eq('id', s.id);
      await log(s.id, correlationId, 'reconciliation.flagged', 'error', { reason });
      await audit('session.flagged_by_reconciliation', s.id, { reason });
    }
  }
  await log(null, correlationId, 'reconciliation.completed', 'info', { checked: sessions?.length ?? 0 });
}

// --------------------------------------------------------------- expiry sweep

async function expireStaleSessions() {
  const { data } = await db.from('sessions')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('id');
  for (const s of data ?? []) await audit('session.expired', s.id);
}

// ------------------------------------------------------------------ main loop

console.log('Stitch worker started. Polling every', POLL_MS, 'ms');
let tick = 0;

async function loop() {
  try {
    const job = await claimNextJob();
    if (job) await processJob(job);

    if (tick % 6 === 0) {        // ~every 30s
      await drainWebhooks();
    }
    if (tick % 12 === 0) {       // ~every minute
      await settleDeferredSessions();
      await expireStaleSessions();
      await nightlyReconciliation();
    }
  } catch (e) {
    console.error('[worker] loop error:', e?.message ?? e);
  }
  tick++;
  setTimeout(loop, POLL_MS);
}

loop();
