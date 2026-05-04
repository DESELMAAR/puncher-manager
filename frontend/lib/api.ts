import axios, { type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";
import { useApiLoadingStore } from "@/store/apiLoadingStore";

const baseURL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";

export const api = axios.create({ baseURL });

const API_LOADING = Symbol("apiGlobalLoading");

function shouldTrackLoading(config: InternalAxiosRequestConfig) {
  if (config.skipGlobalLoading) return false;
  return !(config as unknown as { [API_LOADING]?: boolean })[API_LOADING];
}

function markLoadingTracked(config: InternalAxiosRequestConfig) {
  (config as unknown as { [k: symbol]: boolean })[API_LOADING] = true;
}

api.interceptors.request.use((config) => {
  if (shouldTrackLoading(config)) {
    markLoadingTracked(config);
    useApiLoadingStore.getState().begin();
  }
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      config.headers["X-Client-Timezone"] = tz;
    }
  } catch {
    /* ignore */
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const c = response.config;
    if ((c as unknown as { [k: symbol]: boolean })[API_LOADING]) {
      useApiLoadingStore.getState().end();
    }
    return response;
  },
  (error: { config?: InternalAxiosRequestConfig }) => {
    const c = error.config;
    if (c && (c as unknown as { [k: symbol]: boolean })[API_LOADING]) {
      useApiLoadingStore.getState().end();
    }
    return Promise.reject(error);
  },
);
