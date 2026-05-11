const REMEMBER_ME_KEY = "rememberMe";
const USER_KEY = "conformixUser";
const TOKEN_KEY = "conformixToken";
const SESSION_CHANGED_EVENT = "conformix:session-changed";
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

function notifySessionChanged() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT, {
    detail: {
      user: memoryUser
    }
  }));
}

export function getStoredToken() {
  // JWT is intentionally kept out of browser storage. The app relies on
  // the HttpOnly auth cookie issued by the backend.
  removeRaw(TOKEN_KEY);
  return null;
}

export function getStoredUser() {
  if (memoryUser && typeof memoryUser === "object") {
    return memoryUser;
  }

  const rawUser = readRaw(USER_KEY);

  if (!rawUser || rawUser === "null" || rawUser === "undefined") {
    return null;
  }

  try {
    memoryUser = JSON.parse(rawUser);
    return memoryUser && typeof memoryUser === "object" ? memoryUser : null;
  } catch {
    removeRaw(USER_KEY);
    memoryUser = null;
    return null;
  }
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

export function saveSession({ user, token, rememberMe }) {
  if (!isBrowser()) return;
  const targetStorage = rememberMe ? window.localStorage : window.sessionStorage;
  const secondaryStorage = rememberMe ? window.sessionStorage : window.localStorage;

  secondaryStorage.removeItem(REMEMBER_ME_KEY);
  secondaryStorage.removeItem(USER_KEY);
  secondaryStorage.removeItem(TOKEN_KEY);
  memoryUser = user && typeof user === "object" ? user : null;

  targetStorage.setItem(REMEMBER_ME_KEY, JSON.stringify(Boolean(rememberMe)));
  targetStorage.setItem(USER_KEY, JSON.stringify(memoryUser));
  secondaryStorage.removeItem(TOKEN_KEY);
  targetStorage.removeItem(TOKEN_KEY);
  notifySessionChanged();
}

export function clearSession() {
  memoryUser = null;
  removeRaw(REMEMBER_ME_KEY);
  removeRaw(USER_KEY);
  removeRaw(TOKEN_KEY);
  notifySessionChanged();
}

export function subscribeToStoredUser(callback) {
  if (!isBrowser()) {
    return () => {};
  }

  const handleSessionChanged = (event) => {
    callback(event?.detail?.user ?? getStoredUser());
  };

  const handleStorage = () => {
    callback(getStoredUser());
  };

  window.addEventListener(SESSION_CHANGED_EVENT, handleSessionChanged);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(SESSION_CHANGED_EVENT, handleSessionChanged);
    window.removeEventListener("storage", handleStorage);
  };
}
