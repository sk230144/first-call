export type Question = {
  id: string;
  order: number;
  text: string; // supports {{variable}} substitution
  video_url: string | null;
};

export type TemplateVariable = { key: string; label: string; required: boolean };

export type Template = {
  id: string;
  name: string;
  version: number;
  language: string;
  recording_mode: 'browser' | 'fallback';
  consent_language: string;
  webhook_url: string | null;
  questions: Question[];
  variables: TemplateVariable[];
  is_active: boolean;
};

export type SessionStatus =
  | 'pending' | 'active' | 'completed' | 'approved'
  | 'requires_review' | 'expired' | 'failed';

export type SessionRow = {
  id: string;
  template_id: string;
  template_version: number;
  agent_id: string;
  access_token: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  variable_values: Record<string, string>;
  status: SessionStatus;
  assembly_status: 'not_started' | 'awaiting_segments' | 'queued' | 'processing' | 'done' | 'failed';
  recovery_state: 'none' | 'flagged' | 'in_recovery' | 'resolved' | 'unrecoverable';
  recovery_reason: string | null;
  expected_segment_count: number | null;
  recorder_source: string | null;
  video_url: string | null;
  video_duration_ms: number | null;
  consent_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string;
  created_at: string;
};

/** Substitute {{variable}} placeholders in question text. */
export function substituteVariables(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}
