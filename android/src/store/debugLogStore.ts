/**
 * Lightweight in-memory log ring buffer for the debug overlay.
 * Not persisted — cleared on app restart.
 */

export interface DebugLogEntry {
  ts: number;
  tag: string;
  msg: string;
}

type Listener = (entries: DebugLogEntry[]) => void;

const MAX_ENTRIES = 200;
let entries: DebugLogEntry[] = [];
const listeners = new Set<Listener>();

export function pushDebugLog(tag: string, msg: string) {
  const entry: DebugLogEntry = { ts: Date.now(), tag, msg };
  entries = [...entries.slice(-(MAX_ENTRIES - 1)), entry];
  listeners.forEach(fn => fn(entries));
}

export function getDebugLogs(): DebugLogEntry[] {
  return entries;
}

export function clearDebugLogs() {
  entries = [];
  listeners.forEach(fn => fn(entries));
}

export function subscribeDebugLogs(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
