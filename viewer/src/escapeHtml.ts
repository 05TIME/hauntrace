/**
 * Pure HTML escaping for untrusted (trace-controlled) text that is placed in
 * innerHTML. Escapes & < > " ' and ` so the result is safe both as element
 * text and inside quoted attribute values. Unicode is left untouched.
 */
export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/`/g, "&#96;");
}

/** JSON.stringify for display, escaped. Never throws and never returns undefined. */
export function escapeJson(value: unknown, indent?: number): string {
  let text: string | undefined;
  try {
    text = JSON.stringify(value, null, indent);
  } catch {
    text = undefined;
  }
  return escapeHtml(text ?? String(value));
}
