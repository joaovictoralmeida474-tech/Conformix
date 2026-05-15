import { sendJson } from "./http.mjs";

export function createExpressResponse(nativeRes) {
  let statusCode = 200;

  return {
    status(code) {
      statusCode = code;
      nativeRes.statusCode = code;
      return this;
    },
    json(payload) {
      sendJson(nativeRes, statusCode, payload);
    },
    sendStatus(code) {
      nativeRes.statusCode = code;
      nativeRes.end();
    },
    setHeader(name, value) {
      nativeRes.setHeader(name, value);
    }
  };
}

export function createExpressRequest(nativeReq, options = {}) {
  return {
    method: String(nativeReq.method || "GET").toUpperCase(),
    headers: nativeReq.headers || {},
    query: nativeReq.query || {},
    params: options.params || {},
    body: nativeReq.body || {},
    user: nativeReq.user || null
  };
}
