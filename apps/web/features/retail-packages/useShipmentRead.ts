"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { shipmentError } from "./errors.ts";
import { shipmentListQuery } from "./presentation.ts";
import type { ShipmentPage, RetailQuery } from "./types.ts";
import type { ShipmentApi } from "./api.ts";
type State<T> = {
  key: string;
  api: ShipmentApi;
  status: "loading" | "ready" | "error" | "idle";
  data?: T;
  error?: ReturnType<typeof shipmentError>;
  denied?: boolean;
};
/** Feature-only read lifecycle: same-key retention, abort and generation fencing. */
function useShipmentRead<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  enabled: boolean,
  api: ShipmentApi,
) {
  const latest = useRef(load);
  latest.current = load;
  const currentKey = useRef(key);
  currentKey.current = key;
  const generation = useRef(0);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State<T>>({
    key,
    api,
    status: enabled ? "loading" : "idle",
  });
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController(),
      id = ++generation.current;
    setState((previous) => ({
      key,
      api,
      status: enabled ? "loading" : "idle",
      data:
        enabled &&
        previous.key === key &&
        previous.api === api &&
        !previous.denied
          ? previous.data
          : undefined,
      denied: previous.denied,
    }));
    if (enabled)
      void latest
        .current(controller.signal)
        .then((data) => {
          if (
            !controller.signal.aborted &&
            id === generation.current &&
            key === currentKey.current
          )
            setState({ key, api, status: "ready", data });
        })
        .catch((error) => {
          if (
            controller.signal.aborted ||
            id !== generation.current ||
            key !== currentKey.current
          )
            return;
          const safe = shipmentError(error);
          setState((previous) => ({
            key,
            api,
            status: "error",
            error: safe,
            denied: safe.denied || previous.denied,
            data:
              safe.denied || safe.notFound || previous.denied
                ? undefined
                : previous.data,
          }));
        });
    return () => controller.abort();
  }, [key, revision, enabled, api]);
  const visible: State<T> =
    state.key === key && state.api === api
      ? state
      : {
          key,
          api,
          status: enabled ? ("loading" as const) : ("idle" as const),
        };
  return {
    ...visible,
    data: enabled ? visible.data : undefined,
    loading: enabled && visible.status === "loading",
    refresh,
  };
}
export function useShipmentList(
  query: RetailQuery,
  api: ShipmentApi,
  enabled = true,
) {
  const request = shipmentListQuery(query);
  const read = useShipmentRead(
    JSON.stringify(request),
    (signal) => api.list(request!, signal),
    enabled && request !== null,
    api,
  );
  // Counts ignore stage/paging in the API contract; rows remain full-key-bound.
  const scope = enabled && request ? JSON.stringify([request.q ?? ""]) : null;
  const [statistics, setStatistics] = useState<{
    scope: string;
    api: ShipmentApi;
    stats: ShipmentPage["stats"];
  }>();
  useEffect(() => {
    if (scope === null || read.denied || read.error) {
      setStatistics(undefined);
    } else if (read.status === "ready" && read.data) {
      setStatistics({ scope, api, stats: read.data.stats });
    } else {
      setStatistics((previous) =>
        previous?.scope === scope && previous.api === api
          ? previous
          : undefined,
      );
    }
  }, [scope, api, read.status, read.data, read.denied, read.error]);
  let stats =
    statistics?.scope === scope && statistics.api === api
      ? statistics.stats
      : undefined;
  if (read.status === "ready") stats = read.data?.stats;
  if (scope === null || read.denied || read.error) stats = undefined;
  return { ...read, stats };
}
export function useShipmentDetail(id: string | null, api: ShipmentApi) {
  return useShipmentRead(
    "detail:" + (id ?? ""),
    async (signal) => {
      // Any denial clears retained detail immediately, even if its sibling failed first.
      let rejectDenial: (reason: unknown) => void;
      const denial = new Promise<never>((resolve, reject) => {
        void resolve;
        rejectDenial = reject;
      });
      const watch = <T>(request: Promise<T>) =>
        request.catch((error) => {
          if (shipmentError(error).denied) rejectDenial(error);
          throw error;
        });
      const settled = Promise.allSettled([
        watch(api.get(id!, signal)),
        watch(api.history(id!, { page: 1, pageSize: 100 }, signal)),
      ]).then(([shipment, history]) => {
        if (shipment.status === "rejected") throw shipment.reason;
        if (history.status === "rejected") throw history.reason;
        return { shipment: shipment.value, history: history.value };
      });
      return Promise.race([denial, settled]);
    },
    id !== null,
    api,
  );
}
