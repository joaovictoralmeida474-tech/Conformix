import { api } from "./api";
import { getCacheKey, getCached, setCached } from "./apiCache";

const inflightRequests = new Map();

export async function cachedGet(url, config = {}, options = {}) {
  const { force = false } = options;
  const key = getCacheKey(url, config.params);

  if (!force) {
    const cached = getCached(key);
    if (cached !== undefined) {
      return {
        data: cached,
        status: 200,
        statusText: "OK",
        headers: {},
        config: { url, ...config },
        fromCache: true
      };
    }

    const inflight = inflightRequests.get(key);
    if (inflight) {
      const data = await inflight;
      return {
        data,
        status: 200,
        statusText: "OK",
        headers: {},
        config: { url, ...config },
        fromCache: true
      };
    }
  }

  const request = api.get(url, config).then((response) => {
    setCached(key, response.data);
    return response.data;
  });

  if (!force) {
    inflightRequests.set(key, request);
    request.finally(() => {
      inflightRequests.delete(key);
    });
  }

  try {
    const data = await request;
    return {
      data,
      status: 200,
      statusText: "OK",
      headers: {},
      config: { url, ...config },
      fromCache: false
    };
  } catch (error) {
    if (!force) {
      inflightRequests.delete(key);
    }
    throw error;
  }
}
