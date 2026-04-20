import type { AxiosError } from "axios";

/** Maps Spring / axios errors to a single user-facing string. */
export function extractApiMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const ax = error as AxiosError<{
      message?: string;
      details?: Record<string, string>;
      error?: string;
    }>;
    const data = ax.response?.data;
    if (data?.message) return data.message;
    if (data?.details && typeof data.details === "object") {
      const first = Object.values(data.details)[0];
      if (first) return first;
    }
    if (data?.error && ax.response?.status) {
      return `${data.error} (${ax.response.status})`;
    }
    if (ax.message) return ax.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
