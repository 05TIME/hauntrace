/**
 * formatAction – produces a short card summary for any action value.
 *
 * Rules (pure function, no side-effects):
 *  - number / string → convert to string as-is
 *  - null / undefined → "—"
 *  - object with a numeric "price" field → "$<price>" (shortlet compat)
 *  - object with a string "mood" field → mood value
 *  - object with a string "moodAfter" field → moodAfter value
 *  - any other object → first string-valued field, or "[object]"
 * Result is always truncated to MAX_LEN characters with an ellipsis if longer.
 */

const MAX_LEN = 24;

function truncate(s: string): string {
  return s.length <= MAX_LEN ? s : `${s.slice(0, MAX_LEN - 1)}…`;
}

export function formatAction(action: unknown): string {
  if (action === null || action === undefined) return "—";

  if (typeof action === "number") return String(action);
  if (typeof action === "string") return truncate(action);

  if (typeof action === "object") {
    const obj = action as Record<string, unknown>;

    // Shortlet: numeric price
    if (typeof obj["price"] === "number") return `$${obj["price"]}`;

    // NPC: moodAfter (preferred compact label)
    if (typeof obj["moodAfter"] === "string") return truncate(obj["moodAfter"]);

    // Generic: mood
    if (typeof obj["mood"] === "string") return truncate(obj["mood"]);

    // Fallback: first string-valued field
    for (const v of Object.values(obj)) {
      if (typeof v === "string") return truncate(v);
    }

    return "[object]";
  }

  return truncate(String(action));
}
