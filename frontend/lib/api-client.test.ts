import { describe, expect, it, vi, afterEach } from "vitest";
import { createApiClient, ApiError } from "./api-client";

describe("createApiClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("GETs the configured base URL + path and returns parsed JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createApiClient({ baseUrl: "http://api.test" });
    const result = await client.get<{ status: string }>("/api/health");
    expect(result).toEqual({ status: "ok" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://api.test/api/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("throws ApiError with status and detail on 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createApiClient({ baseUrl: "http://api.test" });
    await expect(client.get("/api/missing")).rejects.toThrow(ApiError);
    await expect(client.get("/api/missing")).rejects.toMatchObject({
      status: 404,
      detail: "not found",
    });
  });

  it("propagates forwarded identity headers when supplied", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createApiClient({
      baseUrl: "http://api.test",
      forwardedHeaders: {
        "X-Forwarded-Email": "duncan.crawford.test@example.com",
        "X-Forwarded-User": "abc-123",
      },
    });
    await client.get("/api/health");
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(init.headers["X-Forwarded-Email"]).toBe(
      "duncan.crawford.test@example.com",
    );
    expect(init.headers["X-Forwarded-User"]).toBe("abc-123");
  });
});
