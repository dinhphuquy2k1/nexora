import type { components } from "@nexora/sdk";
export type ConnectionStatus =
  components["schemas"]["CarrierConnectionDto"]["status"];
/** Readonly presentation data; never credentials, write commands or provider registration. */
export interface CarrierConnectionRow {
  readonly id: string;
  readonly provider: string;
  readonly providerName: string;
  readonly displayName: string;
  readonly loginIdentifier: string | null;
  readonly status: ConnectionStatus;
  readonly lastVerifiedAt: string | null;
  readonly createdAt: string;
}
export interface CarrierQuery {
  search: string;
  provider: string;
  status: "all" | ConnectionStatus;
  page: number;
  pageSize: number;
}
export interface ConnectionDraft {
  displayName: string;
  loginIdentifier: string;
  password: string;
}
/** Separate sync presentation vocabulary, not a backend connection status. */
export interface SyncItem {
  readonly id: string;
  readonly label: string;
  readonly state: "running" | "completed" | "failed" | "unavailable";
  readonly lastSuccess?: string;
  readonly progress?: number;
  readonly processed?: number;
  readonly total?: number;
  readonly detail?: string;
}
export interface SyncHistoryEntry {
  readonly id: string;
  readonly time: string;
  readonly dataType: string;
  readonly source: string;
  readonly state: SyncItem["state"];
  readonly records?: number;
  readonly detail: string;
}
export interface SyncPresentation {
  readonly items: readonly SyncItem[];
  readonly history: readonly SyncHistoryEntry[];
}
