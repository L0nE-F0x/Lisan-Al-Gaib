/**
 * Per-viewer preferences, shared by every page. Storage can be unavailable (private mode,
 * blocked site data), so every access is guarded and the defaults always work.
 */

export interface Prefs {
  /** Sound is opt-in. */
  sound: boolean;
  /** Master volume 0..1. */
  volume: number;
}

const KEY = 'lag:prefs:v1';
const DEFAULTS: Prefs = { sound: false, volume: 0.6 };

type Listener = (prefs: Prefs) => void;
const listeners = new Set<Listener>();

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return { ...DEFAULTS };
  }
}

let current = read();

export function getPrefs(): Readonly<Prefs> {
  return current;
}

export function setPrefs(patch: Partial<Prefs>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: keep in memory only */
  }
  for (const l of listeners) l(current);
}

export function onPrefs(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// Keep tabs in sync.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  current = read();
  for (const l of listeners) l(current);
});

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

export function reducedMotion(): boolean {
  return motionQuery.matches;
}

export function onReducedMotionChange(fn: (reduced: boolean) => void): () => void {
  const handler = () => fn(motionQuery.matches);
  motionQuery.addEventListener('change', handler);
  return () => motionQuery.removeEventListener('change', handler);
}

/** Coarse capability tier for picking texture sizes / effect quality. */
export function deviceTier(): 'low' | 'mid' | 'high' {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 4;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (mem <= 2 || cores <= 2) return 'low';
  if (coarse || mem <= 4) return 'mid';
  return 'high';
}
