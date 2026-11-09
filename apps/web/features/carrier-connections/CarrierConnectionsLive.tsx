"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@nexora/ui";
import { CarrierConnectionsPage } from "./CarrierConnectionsPage.tsx";
import { createSyncApi, SyncApiError } from "./sync-api.ts";
import type { CarrierConnectionRow } from "./types.ts";
const api = createSyncApi();
export function CarrierConnectionsLive() {
  const generation = useRef(0),
    [rows, setRows] = useState<CarrierConnectionRow[]>(),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const v = ++generation.current,
      abort = new AbortController();
    setError("");
    api
      .connections(abort.signal)
      .then((data) => {
        if (v !== generation.current || abort.signal.aborted) return;
        setRows(
          data.map((r) => ({
            ...r,
            providerName: r.provider === "uniship" ? "Uniship" : r.provider,
          })),
        );
      })
      .catch((e) => {
        if (abort.signal.aborted || v !== generation.current) return;
        setRows(undefined);
        if (e instanceof SyncApiError && e.status === 401) return;
        setError("Không thể tải kết nối.");
      });
    return () => {
      abort.abort();
      generation.current++;
    };
  }, [refresh]);
  return (
    <>
      {error && (
        <p role="alert">
          {error}{" "}
          <Button variant="secondary" onClick={() => setRefresh((v) => v + 1)}>
            Thử lại
          </Button>
        </p>
      )}
      <CarrierConnectionsPage records={rows} liveSync />
    </>
  );
}
