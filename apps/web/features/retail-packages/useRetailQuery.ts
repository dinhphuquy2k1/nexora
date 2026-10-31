"use client";
import { useCallback, useMemo, useSyncExternalStore, useState } from "react";
import {
  DEFAULT_RETAIL_QUERY,
  parseRetailQuery,
  tryRetailQueryString,
} from "./query.ts";
import type { RetailQuery } from "./types.ts";
const event = "nexora:retail-query";
function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener(event, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(event, notify);
  };
}
export type RetailQueryChangeOptions =
  | { reset?: boolean; replace?: boolean }
  | boolean;

export function useRetailQuery(initialSearch: string) {
  const [navigationError, setNavigationError] = useState("");
  const raw = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => initialSearch,
  );
  const state = useMemo(() => {
    try {
      return {
        query: parseRetailQuery(new URLSearchParams(raw)),
        invalid: false,
      };
    } catch {
      return { query: DEFAULT_RETAIL_QUERY, invalid: true };
    }
  }, [raw]);
  const change = useCallback(
    (patch: Partial<RetailQuery>, options?: RetailQueryChangeOptions) => {
      const reset =
        typeof options === "boolean" ? options : Boolean(options?.reset);
      const replace =
        typeof options === "object" ? Boolean(options?.replace) : false;
      const next = reset ? DEFAULT_RETAIL_QUERY : { ...state.query, ...patch };
      const qs = tryRetailQueryString(next);
      if (qs === null) {
        setNavigationError(
          "Bộ lọc vượt giới hạn URL. Hãy rút ngắn hoặc bớt điều kiện.",
        );
        return false;
      }
      setNavigationError("");
      const nextSearch = `?${qs}`;
      if (typeof window !== "undefined") {
        if (window.location.search === nextSearch) {
          return true;
        }
        const nextUrl = window.location.pathname + nextSearch;
        if (replace) {
          window.history.replaceState(null, "", nextUrl);
        } else {
          window.history.pushState(null, "", nextUrl);
        }
        window.dispatchEvent(new Event(event));
      }
      return true;
    },
    [state.query],
  );
  return { ...state, change, navigationError };
}
