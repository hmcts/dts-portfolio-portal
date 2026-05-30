import { act, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useSearch } from "./use-search";

// Unit tests for the search hook. Three concerns the hook owns
// that the e2e suite cannot reach reliably:
//
//   1. Debounce — rapid typing must collapse to one fetch.
//   2. Abort — a stale response that arrives after the user changed
//      query must NOT overwrite the new results.
//   3. Error state — a non-OK fetch must populate `error` and clear
//      results.
//
// Approach (matches the project preference for hand-written stubs):
//   * `fetch` is replaced by a hand-rolled function. Each call hands
//     back a `resolve` / `reject` callback so the test can interleave
//     events deterministically.
//   * Vitest fake timers control the 150ms debounce. We use the
//     *Async variants so awaited microtasks (the fetch resolution +
//     React's act flush) interleave correctly with timer ticks.
//     `waitFor` is intentionally avoided — it polls on real timers
//     and deadlocks under fake timers.

interface DeferredResponse {
  resolve(body: unknown, opts?: { status?: number }): void;
  reject(err: Error): void;
  signal: AbortSignal | undefined;
}

interface StubFetch {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  calls: DeferredResponse[];
}

function installStubFetch(): StubFetch {
  const calls: DeferredResponse[] = [];
  const fn = ((_input: unknown, init?: RequestInit) => {
    let resolve!: (body: unknown, opts?: { status?: number }) => void;
    let reject!: (err: Error) => void;
    const promise = new Promise<Response>((res, rej) => {
      resolve = (body, opts) => {
        const status = opts?.status ?? 200;
        res({
          ok: status >= 200 && status < 300,
          status,
          json: async () => body,
        } as Response);
      };
      reject = rej;
    });
    calls.push({
      resolve,
      reject,
      signal: init?.signal ?? undefined,
    });
    return promise;
  }) as StubFetch;
  fn.calls = calls;
  vi.stubGlobal("fetch", fn);
  return fn;
}

// Flush pending microtasks so React state updates triggered by an
// awaited fetch settle before assertions run.
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useSearch", () => {
  let stubFetch: StubFetch;

  beforeEach(() => {
    vi.useFakeTimers();
    stubFetch = installStubFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not fetch for an empty or whitespace-only query", async () => {
    renderHook(({ q }) => useSearch(q), {
      initialProps: { q: "" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(stubFetch.calls).toHaveLength(0);
  });

  it("debounces — typing fast fires ONE fetch after 150ms quiet", async () => {
    const { rerender } = renderHook(({ q }) => useSearch(q), {
      initialProps: { q: "" },
    });
    // Simulate typing 4 characters within 50ms each (well under
    // the 150ms window). Only the last query should land.
    await act(async () => {
      rerender({ q: "c" });
      await vi.advanceTimersByTimeAsync(50);
      rerender({ q: "co" });
      await vi.advanceTimersByTimeAsync(50);
      rerender({ q: "com" });
      await vi.advanceTimersByTimeAsync(50);
      rerender({ q: "comm" });
    });
    expect(stubFetch.calls).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
    });
    expect(stubFetch.calls).toHaveLength(1);
  });

  it("ignores a stale response that resolves after the query changed", async () => {
    const { result, rerender } = renderHook(({ q }) => useSearch(q), {
      initialProps: { q: "first" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
    });
    expect(stubFetch.calls).toHaveLength(1);
    const firstCall = stubFetch.calls[0]!;

    // User types a new query before the first response arrives.
    rerender({ q: "second" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
    });
    expect(stubFetch.calls).toHaveLength(2);
    const secondCall = stubFetch.calls[1]!;

    // The hook should have aborted the first call.
    expect(firstCall.signal?.aborted).toBe(true);

    // Even if the stale first response lands now, it must not be
    // applied to state (the controller is aborted).
    firstCall.resolve({
      results: [{ entityType: "domain", id: "stale", name: "Stale" }],
    });
    await flushMicrotasks();
    expect(result.current.results).toEqual([]);

    // The fresh response IS applied.
    secondCall.resolve({
      results: [{ entityType: "domain", id: "fresh", name: "Fresh" }],
    });
    await flushMicrotasks();
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0]).toMatchObject({ id: "fresh" });
  });

  it("populates `error` on a non-OK response and clears results", async () => {
    const { result } = renderHook(({ q }) => useSearch(q), {
      initialProps: { q: "boom" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
    });
    expect(stubFetch.calls).toHaveLength(1);

    stubFetch.calls[0]!.resolve({}, { status: 500 });
    await flushMicrotasks();

    expect(result.current.error).not.toBeNull();
    expect(result.current.error).toMatch(/500/);
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("populates `error` when the underlying fetch rejects (network error)", async () => {
    const { result } = renderHook(({ q }) => useSearch(q), {
      initialProps: { q: "offline" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
    });

    stubFetch.calls[0]!.reject(new Error("Network error"));
    await flushMicrotasks();

    expect(result.current.error).toBe("Network error");
  });

  it("clears state back to empty when the query is cleared", async () => {
    const { result, rerender } = renderHook(({ q }) => useSearch(q), {
      initialProps: { q: "common" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
    });
    stubFetch.calls[0]!.resolve({
      results: [{ entityType: "domain", id: "a", name: "A" }],
    });
    await flushMicrotasks();
    expect(result.current.results).toHaveLength(1);

    // User clears the input.
    rerender({ q: "" });
    await flushMicrotasks();
    expect(result.current.results).toEqual([]);
    expect(result.current.error).toBeNull();

    // No further fetch even after the debounce window.
    const callsBefore = stubFetch.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(stubFetch.calls).toHaveLength(callsBefore);
  });
});
