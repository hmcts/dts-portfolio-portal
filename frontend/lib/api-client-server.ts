// frontend/lib/api-client-server.ts
import { headers as nextHeaders } from "next/headers";
import { createApiClient, type ApiClient } from "./api-client";

const FORWARDED_HEADERS = [
  "X-Forwarded-Email",
  "X-Forwarded-User",
  "X-Forwarded-Groups",
  "X-Forwarded-Preferred-Username",
];

export function pickForwardedHeaders(source: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of FORWARDED_HEADERS) {
    const value = source.get(name);
    if (value) out[name] = value;
  }
  return out;
}

/**
 * Server-only API client factory. Reads forwarded identity headers from the
 * incoming Next.js request via `headers()` and attaches them to outgoing
 * fetches against the backend. Use from Server Components, route handlers,
 * and server actions.
 */
export async function getServerApiClient(): Promise<ApiClient> {
  const baseUrl =
    process.env.PORTAL_BACKEND_URL ||
    process.env.NEXT_PUBLIC_PORTAL_BACKEND_URL ||
    "http://localhost:8000";
  const requestHeaders = await nextHeaders();
  return createApiClient({
    baseUrl,
    forwardedHeaders: pickForwardedHeaders(requestHeaders),
  });
}
