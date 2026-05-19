import { api } from "./api";
import { getCacheKey, getCached, setCached } from "./apiCache";

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
  }

  const response = await api.get(url, config);
  setCached(key, response.data);
  return response;
}
