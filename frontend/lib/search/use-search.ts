"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "./search";

// React hook for the top-bar search overlay. Debounces the user's
// typing, hits /api/search, and returns the current results +
// loading state. Aborts in-flight requests when a newer query
// arrives so we never render stale matches over fresh ones.

export interface UseSearchState {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
}

export function useSearch(query: string, debounceMs = 150): UseSearchState {
  const [state, setState] = useState<UseSearchState>({
    results: [],
    loading: false,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const q = query.trim();
    if (q === "") {
      setState({ results: [], loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&limit=8`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Search failed: ${res.status}`);
        const body = (await res.json()) as { results: SearchResult[] };
        if (!controller.signal.aborted) {
          setState({ results: body.results, loading: false, error: null });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          results: [],
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, debounceMs]);

  return state;
}
