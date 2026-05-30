// frontend/lib/api-client.ts

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly url: string,
  ) {
    super(`API ${status} on ${url}: ${detail}`);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  forwardedHeaders?: Record<string, string>;
}

export interface ApiClient {
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body: unknown, init?: RequestInit): Promise<T>;
}

function buildHeaders(
  forwardedHeaders: Record<string, string> | undefined,
  override: HeadersInit | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(forwardedHeaders ?? {}),
  };
  if (override) {
    if (override instanceof Headers) {
      override.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(override)) {
      for (const [key, value] of override) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, override);
    }
  }
  return headers;
}

async function parseOrThrow<T>(response: Response, url: string): Promise<T> {
  // Clone so the body stream can be consumed without draining the original.
  const clone = response.clone();
  if (response.ok) {
    return (await clone.json()) as T;
  }
  let detail = response.statusText;
  try {
    const body = (await clone.json()) as { detail?: string };
    if (body.detail) detail = body.detail;
  } catch {
    // body wasn't JSON — keep statusText
  }
  throw new ApiError(response.status, detail, url);
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const base = options.baseUrl.replace(/\/$/, "");

  return {
    async get<T>(path: string, init?: RequestInit): Promise<T> {
      const url = `${base}${path}`;
      const response = await fetch(url, {
        method: "GET",
        headers: buildHeaders(options.forwardedHeaders, init?.headers),
        ...init,
      });
      return parseOrThrow<T>(response, url);
    },
    async post<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
      const url = `${base}${path}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders(options.forwardedHeaders, init?.headers),
        },
        body: JSON.stringify(body),
        ...init,
      });
      return parseOrThrow<T>(response, url);
    },
  };
}
