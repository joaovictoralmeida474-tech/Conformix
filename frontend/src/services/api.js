import axios from "axios";
import { clearSession } from "../utils/authStorage";

export const api = axios.create({
  baseURL: "http://localhost:3000/api",
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
