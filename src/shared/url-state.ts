/**
 * Shareable view state in the query string, e.g. /universe/?year=10191&focus=arrakis
 * Writes use replaceState (no history spam) and are debounced.
 */

export type ParamValue = string | number | null | undefined;

export function readParams(): URLSearchParams {
  return new URLSearchParams(location.search);
}

export function readNumber(key: string): number | undefined {
  const v = readParams().get(key);
  if (v === null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function readString(key: string, allowed?: readonly string[]): string | undefined {
  const v = readParams().get(key) ?? undefined;
  if (v === undefined) return undefined;
  if (allowed && !allowed.includes(v)) return undefined;
  return /^[a-z0-9-]{1,64}$/i.test(v) ? v : undefined;
}

let pending: Record<string, ParamValue> = {};
let timer: number | undefined;

export function writeParams(patch: Record<string, ParamValue>, delay = 250): void {
  pending = { ...pending, ...patch };
  if (timer !== undefined) clearTimeout(timer);
  timer = window.setTimeout(() => {
    const url = new URL(location.href);
    for (const [k, v] of Object.entries(pending)) {
      if (v === null || v === undefined || v === '') url.searchParams.delete(k);
      else url.searchParams.set(k, String(v));
    }
    pending = {};
    history.replaceState(history.state, '', url);
  }, delay);
}

/** The current URL including pending changes, for "copy link". */
export function shareUrl(): string {
  const url = new URL(location.href);
  for (const [k, v] of Object.entries(pending)) {
    if (v === null || v === undefined || v === '') url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  }
  return url.toString();
}
