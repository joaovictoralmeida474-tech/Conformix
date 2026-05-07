const TOKEN_KEY = "token";
const USER_KEY = "user";
const REMEMBER_ME_KEY = "rememberMe";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readRaw(key) {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(key);
}

function removeRaw(key) {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key);
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

export function mapSupabaseUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  const metadata = user.user_metadata && typeof user.user_metadata === "object"
    ? user.user_metadata
    : {};

  return {
    id: user.id,
    email: user.email || "",
    name: metadata.name || metadata.full_name || user.email || "Administrador",
    role: metadata.role || metadata.user_role || "ADMIN",
  };
}

export function saveSession({ token, user, rememberMe }) {
  if (!isBrowser()) return;

  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    removeRaw(TOKEN_KEY);
  }

  if (user && typeof user === "object") {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    removeRaw(USER_KEY);
  }

  window.localStorage.setItem(REMEMBER_ME_KEY, JSON.stringify(Boolean(rememberMe)));
}

export function saveSupabaseSession(session, rememberMe = getRememberMePreference()) {
  if (!session) {
    clearSession();
    return;
  }

  saveSession({
    token: session.access_token || null,
    user: mapSupabaseUser(session.user),
    rememberMe,
  });
}

export function clearSession() {
  removeRaw(TOKEN_KEY);
  removeRaw(USER_KEY);
  removeRaw(REMEMBER_ME_KEY);
}
