const TOKEN_KEY = "token";
const USER_KEY = "user";
const REMEMBER_ME_KEY = "rememberMe";

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
  const token = readRaw(TOKEN_KEY);

  if (!token || token === "null" || token === "undefined") {
    return null;
  }

  return token;
}

export function getStoredUser() {
  const rawUser = readRaw(USER_KEY);

  if (!rawUser || rawUser === "null" || rawUser === "undefined") {
    return null;
  }

  try {
    const parsed = JSON.parse(rawUser);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    removeRaw(USER_KEY);
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

export function saveSession({ token, user, rememberMe }) {
  if (!isBrowser()) return;
  const targetStorage = rememberMe ? window.localStorage : window.sessionStorage;
  const secondaryStorage = rememberMe ? window.sessionStorage : window.localStorage;

  secondaryStorage.removeItem(TOKEN_KEY);
  secondaryStorage.removeItem(USER_KEY);
  secondaryStorage.removeItem(REMEMBER_ME_KEY);

  if (token) {
    targetStorage.setItem(TOKEN_KEY, token);
  } else {
    removeRaw(TOKEN_KEY);
  }

  if (user && typeof user === "object") {
    targetStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    removeRaw(USER_KEY);
  }

  targetStorage.setItem(REMEMBER_ME_KEY, JSON.stringify(Boolean(rememberMe)));
}

export function clearSession() {
  removeRaw(TOKEN_KEY);
  removeRaw(USER_KEY);
  removeRaw(REMEMBER_ME_KEY);
}
