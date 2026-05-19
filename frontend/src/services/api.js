import axios from "axios";
import { clearApiCache, invalidateCacheForMutation, normalizeRequestPath } from "./apiCache";
import { clearSession } from "../utils/authStorage";

function resolveApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  const isBrowser = typeof window !== "undefined";

  if (isBrowser) {
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";

    if (configuredBaseUrl && isLocalHost) {
      return configuredBaseUrl;
    }

    return `${window.location.origin}/api`;
  }

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  return "http://localhost:3000/api";
}

function isAuthRouteRequest(url = "") {
  const normalizedUrl = String(url);

  return (
    normalizedUrl.includes("/auth/login") ||
    normalizedUrl.includes("/auth/session") ||
    normalizedUrl.includes("/auth/register")
  );
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true
});

function getRequestPath(config = {}) {
  const requestUrl = String(config.url || "");

  if (/^https?:\/\//i.test(requestUrl)) {
    return normalizeRequestPath(requestUrl);
  }

  const baseURL = String(config.baseURL || api.defaults.baseURL || "").replace(/\/$/, "");
  const relativeUrl = requestUrl.startsWith("/") ? requestUrl : `/${requestUrl}`;

  return normalizeRequestPath(`${baseURL}${relativeUrl}`);
}

api.interceptors.response.use(
  response => {
    const method = String(response?.config?.method || "get").toUpperCase();
    const requestPath = getRequestPath(response?.config);

    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      invalidateCacheForMutation(requestPath);
    }

    return response;
  },
  error => {
    const status = error?.response?.status;
    const isAuthFailure = status === 401 || status === 403;
    const requestUrl = String(error?.config?.url || "");

    if (isAuthFailure && !isAuthRouteRequest(requestUrl)) {
      clearApiCache();
      clearSession();

      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.replace("/");
      }
    }

    return Promise.reject(error);
  }
);
