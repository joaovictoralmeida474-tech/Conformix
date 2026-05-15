import axios from "axios";
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

api.interceptors.response.use(
  response => response,
  error => {
    const status = error?.response?.status;
    const isAuthFailure = status === 401 || status === 403;
    const requestUrl = String(error?.config?.url || "");

    if (isAuthFailure && !isAuthRouteRequest(requestUrl)) {
      clearSession();

      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.replace("/");
      }
    }

    return Promise.reject(error);
  }
);
