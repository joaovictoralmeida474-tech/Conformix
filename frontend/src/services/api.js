import axios from "axios";
import { clearSession } from "../utils/authStorage";

function resolveApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }

  return "http://localhost:3000/api";
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true
});

api.interceptors.response.use(
  response => response,
  error => {
    const status = error?.response?.status;
    const isAuthFailure =
      status === 401 ||
      status === 403;

    if (isAuthFailure) {
      clearSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.replace("/");
      }
    }

    return Promise.reject(error);
  }
);
