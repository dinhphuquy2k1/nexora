"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@nexora/ui";
import { CarrierConnectionsPage } from "./CarrierConnectionsPage.tsx";
import { createSyncApi, SyncApiError } from "./sync-api.ts";
import { CarrierPartialEditError } from "./edit-error.ts";
import { syncPresentation } from "./sync-response.ts";
import type {
  CarrierConnectionRow,
  ConnectionDraft,
  SyncPresentation,
} from "./types.ts";
const api = createSyncApi();
export function CarrierConnectionsLive() {
  const generation = useRef(0),
    [rows, setRows] = useState<CarrierConnectionRow[]>(),
    [syncByConnection, setSyncByConnection] = useState<
      Readonly<Record<string, SyncPresentation>>
    >({}),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const v = ++generation.current,
      abort = new AbortController();
    setLoading(true);
    setError("");
    api
      .connections(abort.signal)
      .then(async (data) => {
        if (v !== generation.current || abort.signal.aborted) return;
        const mapped = data.map((r) => ({
          ...r,
          providerName: r.provider === "uniship" ? "Uniship" : r.provider,
        }));
        setRows(mapped);
        if (!mapped.length) {
          setSyncByConnection({});
          return;
        }
        const entries = await Promise.all(
          mapped.map(async (r) => {
            try {
              const [configs, jobs] = await Promise.all([
                api.configs(r.id, abort.signal),
                api.jobs(r.id, 1, abort.signal),
              ]);
              return [r.id, syncPresentation(configs, jobs)] as const;
            } catch (err) {
              if (err instanceof SyncApiError && err.status === 401) throw err;
              return null;
            }
          }),
        );
        if (v !== generation.current || abort.signal.aborted) return;
        const nextSync: Record<string, SyncPresentation> = {};
        for (const entry of entries) if (entry) nextSync[entry[0]] = entry[1];
        setSyncByConnection(nextSync);
      })
      .catch((e) => {
        if (abort.signal.aborted || v !== generation.current) return;
        setRows(undefined);
        setSyncByConnection({});
        if (e instanceof SyncApiError && e.status === 401) return;
        setError("Không thể tải kết nối.");
      })
      .finally(() => {
        if (v === generation.current && !abort.signal.aborted)
          setLoading(false);
      });
    return () => {
      abort.abort();
      generation.current++;
    };
  }, [refresh]);
  const triggerRefresh = () => setRefresh((v) => v + 1);
  return (
    <>
      {error && (
        <p role="alert">
          {error}{" "}
          <Button variant="secondary" onClick={triggerRefresh}>
            Thử lại
          </Button>
        </p>
      )}
      <CarrierConnectionsPage
        records={rows}
        syncByConnection={syncByConnection}
        liveSync
        refreshing={loading}
        onRefresh={triggerRefresh}
        onConnect={async (draft: ConnectionDraft) => {
          await api.connect({
            provider: "uniship",
            loginIdentifier: draft.loginIdentifier,
            password: draft.password,
            displayName: draft.displayName,
          });
          triggerRefresh();
        }}
        onEditConnection={async (
          row: CarrierConnectionRow,
          draft: ConnectionDraft,
        ) => {
          let mutated = false;
          try {
            if (draft.password.length > 0) {
              await api.reconnect(row.id, draft.password);
              mutated = true;
            }
            if (draft.displayName !== row.displayName) {
              try {
                await api.rename(row.id, draft.displayName);
                mutated = true;
              } catch (error) {
                if (!mutated) throw error;
                const rejected =
                  error instanceof SyncApiError &&
                  error.status >= 400 &&
                  error.status < 500;
                throw new CarrierPartialEditError(
                  rejected ? "rejected" : "unknown",
                  error instanceof SyncApiError && error.status === 401,
                );
              }
            }
          } finally {
            if (mutated) triggerRefresh();
          }
        }}
        onReadConnection={async (row, signal) => {
          const records = await api.connections(signal);
          const current = records.find((record) => record.id === row.id);
          if (!current || typeof current.displayName !== "string") return null;
          return {
            ...current,
            providerName:
              current.provider === "uniship" ? "Uniship" : current.provider,
          };
        }}
        onDisconnect={async (row: CarrierConnectionRow) => {
          await api.remove(row.id);
          triggerRefresh();
        }}
      />
    </>
  );
}
