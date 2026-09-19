/**
 * Every {{variable}} used in a document body must be a required variable,
 * or a customer could see the literal "{{key}}" text in their signed
 * document instead of real data.
 */
export function validateDocumentTemplateVariables(
  body: string,
  variables: { key: string; required: boolean }[]
): string | null {
  const referenced = [...new Set([...(body ?? '').matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]))];
  const definedKeys = new Set(variables.map((v) => v.key));

  const undefinedKeys = referenced.filter((k) => !definedKeys.has(k));
  if (undefinedKeys.length > 0) {
    return `undefined variables referenced in the document: ${undefinedKeys.join(', ')}`;
  }
  const notRequired = variables.filter((v) => referenced.includes(v.key) && !v.required).map((v) => v.key);
  if (notRequired.length > 0) {
    return `variables used in the document must be required: ${notRequired.join(', ')}`;
  }
  return null;
}
