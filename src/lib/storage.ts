type JsonValue = unknown;

export function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readJson<T>(key: string, fallback: T): T {
  if (!canUseBrowserStorage()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: JsonValue) {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Some browsers/environments can throw (quota, disabled storage, private mode).
    // We intentionally swallow to keep mock auth stable.
  }
}

export function removeKey(key: string) {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Swallow for stability; callers treat missing session as logged out.
  }
}

