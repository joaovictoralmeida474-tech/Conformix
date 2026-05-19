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

export function getCacheKey(url, params) {
  const path = String(url || "").split("?")[0];
  return `${path}|${normalizeParams(params)}`;
}

export function getCached(key) {
  if (!store.has(key)) {
    return undefined;
  }

  return store.get(key);
}

export function setCached(key, data) {
  store.set(key, data);
}

export function invalidateByUrlPrefix(urlPrefix) {
  const prefix = String(urlPrefix || "").split("?")[0];

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
  const path = String(url || "").split("?")[0];

  if (path.startsWith("/suppliers")) {
    invalidateByUrlPrefix("/suppliers");
    return;
  }

  if (path.startsWith("/categories")) {
    invalidateByUrlPrefix("/categories");
    return;
  }

  if (path.startsWith("/rnc")) {
    invalidateByUrlPrefix("/rnc");
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
