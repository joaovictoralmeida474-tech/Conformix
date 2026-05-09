const REMEMBER_ME_KEY = "rememberMe";
let memoryUser = null;

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readLocal(key) {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(key);
}

function readSession(key) {
  if (!isBrowser() || typeof window.sessionStorage === "undefined") return null;
  return window.sessionStorage.getItem(key);
}

function readRaw(key) {
  return readSession(key) ?? readLocal(key);
}

function removeRaw(key) {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key);
  if (typeof window.sessionStorage !== "undefined") {
    window.sessionStorage.removeItem(key);
  }
}

export function getStoredToken() {
  return null;
}

export function getStoredUser() {
  return memoryUser && typeof memoryUser === "object" ? memoryUser : null;
}

export function getRememberMePreference() {
  const rawValue = readRaw(REMEMBER_ME_KEY);

  if (!rawValue || rawValue === "null" || rawValue === "undefined") {
    return false;
  }

  try {
    return Boolean(JSON.parse(rawValue));
  } catch {
    removeRaw(REMEMBER_ME_KEY);
    return false;
  }
}

export function saveSession({ user, rememberMe }) {
  if (!isBrowser()) return;
  const targetStorage = rememberMe ? window.localStorage : window.sessionStorage;
  const secondaryStorage = rememberMe ? window.sessionStorage : window.localStorage;

  secondaryStorage.removeItem(REMEMBER_ME_KEY);
  memoryUser = user && typeof user === "object" ? user : null;

  targetStorage.setItem(REMEMBER_ME_KEY, JSON.stringify(Boolean(rememberMe)));
}

export function clearSession() {
  memoryUser = null;
  removeRaw(REMEMBER_ME_KEY);
}
