import axios from "axios";
import { getStoredToken } from "../utils/authStorage";

export const api = axios.create({
  baseURL: "http://localhost:3000/api"
});

api.interceptors.request.use(config => {
  const token = getStoredToken();
  if (token) config.headers.authorization = token;
  return config;
});
