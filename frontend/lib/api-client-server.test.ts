// frontend/lib/api-client-server.test.ts
import { describe, expect, it } from "vitest";
import { pickForwardedHeaders } from "./api-client-server";

describe("pickForwardedHeaders", () => {
  it("picks only the forwarded identity headers", () => {
    const headers = new Headers({
      "X-Forwarded-Email": "duncan.crawford.test@example.com",
      "X-Forwarded-User": "abc-123",
      "X-Forwarded-Groups": "engineering,leadership",
      Cookie: "session=opaque",
      "User-Agent": "Mozilla/5.0",
    });
    const picked = pickForwardedHeaders(headers);
    expect(picked).toEqual({
      "X-Forwarded-Email": "duncan.crawford.test@example.com",
      "X-Forwarded-User": "abc-123",
      "X-Forwarded-Groups": "engineering,leadership",
    });
  });

  it("returns an empty object when no identity headers are present", () => {
    expect(pickForwardedHeaders(new Headers({ "User-Agent": "x" }))).toEqual(
      {},
    );
  });
});
