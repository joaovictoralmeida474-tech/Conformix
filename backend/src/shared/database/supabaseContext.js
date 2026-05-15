import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage();

export function runWithSupabaseAccessToken(accessToken, callback) {
  const token = String(accessToken || "").trim();

  if (!token) {
    return callback();
  }

  return storage.run({ accessToken: token }, callback);
}

export function getSupabaseAccessToken() {
  return String(storage.getStore()?.accessToken || "").trim();
}
