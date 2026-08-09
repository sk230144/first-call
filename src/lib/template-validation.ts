/**
 * Every {{variable}} used in a question or consent line must be a required
 * variable, or a session's customer could see the literal "{{key}}" text
 * instead of real data.
 */
export function validateTemplateVariables(
  questions: { text?: string }[],
  consentLanguage: string,
  variables: { key: string; required: boolean }[]
): string | null {
  const text = [consentLanguage ?? '', ...questions.map((q) => q.text ?? '')].join(' ');
  const referenced = [...new Set([...text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]))];
  const definedKeys = new Set(variables.map((v) => v.key));

  const undefinedKeys = referenced.filter((k) => !definedKeys.has(k));
  if (undefinedKeys.length > 0) {
    return `undefined variables referenced in questions: ${undefinedKeys.join(', ')}`;
  }
  const notRequired = variables.filter((v) => referenced.includes(v.key) && !v.required).map((v) => v.key);
  if (notRequired.length > 0) {
    return `variables used in questions must be required: ${notRequired.join(', ')}`;
  }
  return null;
}
