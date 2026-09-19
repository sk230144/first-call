import { NextResponse } from 'next/server';
import { authenticateDocumentSessionToken, extractDocumentToken } from '@/lib/document-session-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/public/document-session/[id]/confirmation-video-url
 * Issues a signed upload URL for the single short "I have signed this
 * agreement" confirmation clip. Unlike the video-call flow, this is one
 * short recording (a few seconds), not a long segmented call — so a
 * single direct upload is used instead of the segment/queue machinery.
 * Deterministic path: safe to retry.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const auth = await authenticateDocumentSessionToken(params.id, extractDocumentToken(req, url, body));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const storagePath = `document-sessions/${session.id}/confirmation.webm`;
  const db = supabaseAdmin();
  const { data, error } = await db.storage
    .from('signed-documents')
    .createSignedUploadUrl(storagePath, { upsert: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ upload_url: data.signedUrl, storage_path: storagePath });
}
