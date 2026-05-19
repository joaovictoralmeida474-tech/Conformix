const store = new Map();

function normalizeParams(params) {
  if (!params || typeof params !== "object") {
    return "";
  }

  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));

  return JSON.stringify(entries);
}

export function normalizeRequestPath(url = "") {
  let path = String(url || "").trim();
  if (!path) {
    return "";
  }

  try {
    if (/^https?:\/\//i.test(path)) {
      path = new URL(path).pathname;
    }
  } catch {
    // Mantem o path original se a URL for invalida.
  }

  const apiMatch = path.match(/\/api(\/.*)$/i);
  if (apiMatch?.[1]) {
    path = apiMatch[1];
  }

  path = path.split("?")[0];
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  return path;
}

export function getCacheKey(url, params) {
  const path = normalizeRequestPath(url);
  return `${path}|${normalizeParams(params)}`;
}

function cloneValue(value) {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((item) => (item && typeof item === "object" ? { ...item } : item));
  }

  if (value && typeof value === "object") {
    return { ...value };
  }

  return value;
}

export function getCached(key) {
  if (!store.has(key)) {
    return undefined;
  }

  return cloneValue(store.get(key));
}

export function setCached(key, data) {
  store.set(key, cloneValue(data));
}

export function invalidateByUrlPrefix(urlPrefix) {
  const prefix = normalizeRequestPath(urlPrefix);

  for (const key of store.keys()) {
    const path = key.split("|")[0];
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      store.delete(key);
    }
  }
}

export function clearApiCache() {
  store.clear();
}

export function invalidateCacheForMutation(url = "") {
  const path = normalizeRequestPath(url);

  if (path.startsWith("/suppliers")) {
    invalidateByUrlPrefix("/suppliers");
    invalidateByUrlPrefix("/dashboard");
    return;
  }

  if (path.startsWith("/categories")) {
    invalidateByUrlPrefix("/categories");
    invalidateByUrlPrefix("/suppliers");
    invalidateByUrlPrefix("/dashboard");
    return;
  }

  if (path.startsWith("/rnc")) {
    invalidateByUrlPrefix("/rnc");
    invalidateByUrlPrefix("/dashboard");
    invalidateByUrlPrefix("/suppliers");
    return;
  }

  if (path.startsWith("/admin")) {
    invalidateByUrlPrefix("/admin");
    return;
  }

  if (path.startsWith("/dashboard")) {
    invalidateByUrlPrefix("/dashboard");
    return;
  }

  if (path.startsWith("/audit")) {
    invalidateByUrlPrefix("/audit");
    return;
  }

  if (path.startsWith("/evaluations")) {
    invalidateByUrlPrefix("/suppliers");
    invalidateByUrlPrefix("/dashboard");
  }
}
