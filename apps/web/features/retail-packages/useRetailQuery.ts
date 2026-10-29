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
    (patch: Partial<RetailQuery>, reset = false) => {
      const next = reset ? DEFAULT_RETAIL_QUERY : { ...state.query, ...patch };
      const query = tryRetailQueryString(next);
      if (query === null) {
        setNavigationError(
          "Bộ lọc vượt giới hạn URL. Hãy rút ngắn hoặc bớt điều kiện.",
        );
        return false;
      }
      setNavigationError("");
      window.history.pushState(
        null,
        "",
        window.location.pathname + "?" + query,
      );
      window.dispatchEvent(new Event(event));
      return true;
    },
    [state.query],
  );
  return { ...state, change, navigationError };
}
