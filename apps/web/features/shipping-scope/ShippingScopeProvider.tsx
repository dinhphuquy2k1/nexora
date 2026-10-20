"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RETAIL_ROUTE } from "../../lib/navigation/nav-config.ts";
import { createNexoraClient } from "@nexora/sdk";
import {
  groupMetadata,
  parseScope,
  resolveScope,
  writeScope,
  type CarrierGroup,
  type ParsedScope,
  type Scope,
} from "./model.ts";

type Metadata =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; groups: CarrierGroup[] };
interface ScopeContext {
  scope: ParsedScope;
  metadata: Metadata;
  label: string;
  valid: boolean;
  choose: (scope: Scope) => void;
  retry: () => void;
  shippingHref: string;
}
const Context = createContext<ScopeContext | null>(null);

export function ShippingScopeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const isShipping =
    pathname === RETAIL_ROUTE || pathname.startsWith(`${RETAIL_ROUTE}/`);
  const [lastQuery, setLastQuery] = useState("");
  const [metadata, setMetadata] = useState<Metadata>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (isShipping) setLastQuery(query);
  }, [isShipping, query]);
  useEffect(() => {
    const controller = new AbortController();
    setMetadata({ status: "loading" });
    const client = createNexoraClient();
    void (async () => {
      try {
        const [carriers, connections] = await Promise.all([
          client.GET("/api/carriers", {
            signal: controller.signal,
            cache: "no-store",
          }),
          client.GET("/api/carrier-connections", {
            signal: controller.signal,
            cache: "no-store",
          }),
        ]);
        if (
          !carriers.response.ok ||
          !connections.response.ok ||
          !Array.isArray(carriers.data?.carriers) ||
          !Array.isArray(connections.data?.connections)
        )
          throw new Error("metadata unavailable");
        const groups = groupMetadata(
          carriers.data.carriers,
          connections.data.connections,
        );
        if (!controller.signal.aborted)
          setMetadata({ status: "ready", groups });
      } catch {
        if (!controller.signal.aborted) setMetadata({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [attempt]);
  const shippingQuery = isShipping ? query : lastQuery;
  const scope = parseScope(new URLSearchParams(shippingQuery));
  const resolved =
    metadata.status === "ready"
      ? resolveScope(scope, metadata.groups)
      : {
          valid: false,
          label:
            metadata.status === "loading"
              ? "Đang tải hãng…"
              : "Không tải được hãng",
        };
  const shippingHref = `${RETAIL_ROUTE}${shippingQuery ? `?${shippingQuery}` : ""}`;
  function choose(next: Scope) {
    const updated = writeScope(
      new URLSearchParams(shippingQuery),
      next,
    ).toString();
    router.push(
      `${RETAIL_ROUTE}${updated ? `?${updated}` : ""}${isShipping ? window.location.hash : ""}`,
      { scroll: false },
    );
  }
  return (
    <Context.Provider
      value={{
        scope,
        metadata,
        ...resolved,
        choose,
        retry: () => setAttempt((n) => n + 1),
        shippingHref,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useShippingScope() {
  const value = useContext(Context);
  if (!value) throw new Error("Shipping scope requires workspace provider");
  return value;
}
