// Strava's identifiers, kept intact.
//
// From 1 June 2027 Strava's activity and athlete ids become 64-bit. JavaScript
// numbers hold integers exactly only up to 2^53-1, and the damage is done by
// JSON.parse before any of our code sees the value: 12345678901234567890 comes
// back as 12345678901234567000, and String() on it faithfully preserves the
// wrong number. An activity would be stored under an id that does not exist,
// so it would import again on the next webhook, and for ever.
//
// Strava now also returns `id_str` and recommends using it. Where they send it
// we take it; where they do not — the webhook payload — we read the digits out
// of the raw body before the parser can round them.

/** The largest integer JavaScript can hold without silently rounding. */
export const MAX_SAFE = Number.MAX_SAFE_INTEGER;

export type WithStravaId = { id?: number | string | null; id_str?: string | null };

/**
 * An object's Strava id, as a string, preferring the one that cannot be wrong.
 *
 * Returns null rather than a guess when there is nothing usable: a caller that
 * writes rows keyed on this should stop, not invent.
 */
export function stravaId(obj: WithStravaId | null | undefined): string | null {
  if (!obj) return null;
  if (typeof obj.id_str === "string" && /^\d+$/.test(obj.id_str)) return obj.id_str;

  const id = obj.id;
  if (typeof id === "string" && /^\d+$/.test(id)) return id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

/**
 * Whether this id arrived as a number big enough to have been rounded already.
 *
 * Cannot prove the value is wrong — only that it is past the point where it
 * could be. Worth saying out loud in a log rather than carrying on quietly.
 */
export function mayHaveLostPrecision(obj: WithStravaId | null | undefined): boolean {
  return typeof obj?.id === "number" && !obj.id_str && obj.id > MAX_SAFE;
}

/**
 * Pulls one numeric field out of raw JSON text, as digits.
 *
 * For payloads that carry no `id_str` and would otherwise have to go through
 * JSON.parse. Accepts the value quoted or bare, because Strava may well start
 * sending these as strings and that should not be a second migration.
 */
export function idFromJsonText(json: string, field: string): string | null {
  const m = json.match(new RegExp(`"${field}"\\s*:\\s*"?(\\d+)"?`));
  return m ? m[1] : null;
}
