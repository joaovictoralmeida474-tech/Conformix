import axios from "axios";
import { clearSession, getStoredToken } from "../utils/authStorage";

export const api = axios.create({
  baseURL: "http://localhost:3000/api"
});

api.interceptors.request.use(config => {
  const token = getStoredToken();
  if (token) config.headers.authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.error || "").toLowerCase();
    const isAuthFailure =
      status === 401 ||
      status === 403 ||
      message.includes("token invalido") ||
      message.includes("token nao informado") ||
      message.includes("usuario nao encontrado");

    if (isAuthFailure) {
      clearSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.replace("/");
      }
    }

    return Promise.reject(error);
  }
);
