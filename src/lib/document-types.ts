export type DocumentVariable = { key: string; label: string; required: boolean };

export type DocumentTemplate = {
  id: string;
  name: string;
  version: number;
  body: string; // supports {{variable}} placeholders
  variables: DocumentVariable[];
  is_active: boolean;
};

export type DocumentSessionStatus = 'pending' | 'active' | 'completed' | 'expired';

export type SignatureType = 'typed' | 'drawn';

export type DocumentSessionRow = {
  id: string;
  document_template_id: string;
  template_version: number;
  agent_id: string;
  access_token: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  variable_values: Record<string, string>;
  status: DocumentSessionStatus;
  signature_type: SignatureType | null;
  signature_data: string | null;
  signed_document_path: string | null;
  signed_document_pdf_path: string | null;
  confirmation_video_path: string | null;
  signed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string;
  created_at: string;
};

/** Every {{key}} referenced in a document body, in first-appearance order, deduped. */
export function referencedVariableKeys(body: string): string[] {
  const matches = [...body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(matches)];
}

/** Substitutes {{variable}} placeholders. Unfilled keys are left as literal {{key}}
 * so a live preview visibly shows what's still missing, rather than silently blanking it. */
export function substituteDocumentVariables(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) =>
    values[key] && values[key].length > 0 ? values[key] : match
  );
}
