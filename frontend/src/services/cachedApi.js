import { api } from "./api";
import { getCacheKey, getCached, isCacheFresh, setCached } from "./apiCache";

const inflightRequests = new Map();
const DEFAULT_TTL_MS = 90_000;

function buildResponse(url, config, data, fromCache = false, stale = false) {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { url, ...config },
    fromCache,
    stale
  };
}

export async function cachedGet(url, config = {}, options = {}) {
  const { force = false, ttlMs = DEFAULT_TTL_MS } = options;
  const key = getCacheKey(url, config.params);
  const cached = getCached(key);
  const fresh = isCacheFresh(key, ttlMs);

  if (!force && cached !== undefined && fresh) {
    return buildResponse(url, config, cached, true, false);
  }

  if (!force && cached !== undefined) {
    void revalidateGet(url, config, key, ttlMs);
    return buildResponse(url, config, cached, true, true);
  }

  const inflight = inflightRequests.get(key);
  if (!force && inflight) {
    const data = await inflight;
    return buildResponse(url, config, data, true, !isCacheFresh(key, ttlMs));
  }

  const request = api
    .get(url, config)
    .then((response) => {
      setCached(key, response.data, ttlMs);
      return response.data;
    })
    .finally(() => {
      inflightRequests.delete(key);
    });

  if (!force) {
    inflightRequests.set(key, request);
  }

  const data = await request;
  return buildResponse(url, config, data, false, false);
}

async function revalidateGet(url, config, key, ttlMs) {
  if (inflightRequests.has(key)) {
    return;
  }

  const request = api
    .get(url, config)
    .then((response) => {
      setCached(key, response.data, ttlMs);
      return response.data;
    })
    .finally(() => {
      inflightRequests.delete(key);
    });

  inflightRequests.set(key, request);

  try {
    await request;
  } catch {
    // Mantem o cache antigo se a revalidacao falhar.
  }
}
