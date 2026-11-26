// Resume positions, persisted in localStorage so a video reopened later —
// even after the Tesla browser reloads the page between drives — continues
// where it left off. Keyed by YouTube videoId (or title for direct streams).
// Entries carry enough metadata to render a Netflix-style "Keep Watching"
// row on the dashboard and reopen the right player.

const KEY = "yavik:resume:v1";
const MAX_ENTRIES = 50;

export type ResumeKind = "youtube" | "ein" | "pluto" | "direct";

export interface ResumeMeta {
  title?: string;
  videoId?: string;
  streamUrl?: string;
  kind?: ResumeKind;
}

interface Entry extends ResumeMeta {
  t: number; // seconds watched
  d: number; // duration in seconds (0 if unknown)
  at: number; // last-updated epoch ms, for LRU eviction + ordering
}

export interface ResumeItem extends Entry {
  key: string;
}

type Store = Record<string, Entry>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode / storage full — resume just won't persist */
  }
}

export function savePosition(key: string, t: number, d: number, meta?: ResumeMeta) {
  if (!key || !isFinite(t) || t < 5) return;
  const store = read();
  // Watched to (nearly) the end: forget it so next open starts from the top.
  if (d > 0 && (t > d - 15 || t / d > 0.97)) {
    if (store[key]) {
      delete store[key];
      write(store);
    }
    return;
  }
  const prev = store[key];
  store[key] = {
    ...prev,
    ...meta,
    t: Math.floor(t),
    d: Math.floor(d || prev?.d || 0),
    at: Date.now(),
  };
  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    keys.sort((a, b) => store[a].at - store[b].at);
    for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete store[k];
  }
  write(store);
}

export function getPosition(key: string): number {
  if (!key) return 0;
  const e = read()[key];
  return e && isFinite(e.t) && e.t > 5 ? e.t : 0;
}

export function clearPosition(key: string) {
  if (!key) return;
  const store = read();
  if (store[key]) {
    delete store[key];
    write(store);
  }
}

// Most-recent-first list for the Keep Watching row.
export function listResume(limit = 10): ResumeItem[] {
  const store = read();
  return Object.entries(store)
    .map(([key, e]) => ({ key, ...e }))
    .filter((e) => e.t > 5)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}
