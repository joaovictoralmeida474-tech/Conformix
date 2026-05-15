import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage();

export function runWithSupabaseAccessToken(accessToken, callback) {
  const token = String(accessToken || "").trim();
  return storage.run({ accessToken: token }, callback);
}

export async function runWithSupabaseAccessTokenAsync(accessToken, callback) {
  return runWithSupabaseAccessToken(accessToken, callback);
}

export function getSupabaseAccessToken() {
  return String(storage.getStore()?.accessToken || "").trim();
}
