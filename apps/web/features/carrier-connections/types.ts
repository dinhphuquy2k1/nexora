import type { components } from "@nexora/sdk";
export type ConnectionStatus =
  components["schemas"]["CarrierConnectionDto"]["status"];
export type CarrierTab = "all" | "connected" | "needs_check" | "sandbox";
/** Presentation-only optional metadata supplied by isolated previews, never asserted by the production route. */
export interface CarrierPreviewMetadata {
  readonly code?: string;
  readonly syncing?: boolean;
  readonly tone?: "primary" | "info";
  readonly environment?: "production" | "sandbox";
  readonly lastSyncDisplay?: string;
  readonly lastSyncRelative?: string;
  readonly lastSyncSource?: string;
  readonly features?: readonly string[];
}
export interface CarrierConnectionRow {
  readonly id: string;
  readonly provider: string;
  readonly providerName: string;
  readonly displayName: string;
  readonly loginIdentifier: string | null;
  readonly status: ConnectionStatus;
  readonly lastVerifiedAt: string | null;
  readonly createdAt: string;
  readonly preview?: CarrierPreviewMetadata;
}
export type CarrierFilterField =
  | "carrier"
  | "status"
  | "environment"
  | "accountName";
export type CarrierFilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains";
export interface CarrierFilterCondition {
  readonly id: string;
  readonly field: CarrierFilterField;
  readonly operator: CarrierFilterOperator;
  readonly value: string;
}
export interface CarrierQuery {
  search: string;
  tab: CarrierTab;
  conditions: readonly CarrierFilterCondition[];
  page: number;
  pageSize: number;
}
export interface ConnectionDraft {
  displayName: string;
  loginIdentifier: string;
  password: string;
}
export interface CarrierProviderPresentation {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly tone?: "primary" | "info";
}
export type SyncState =
  | "running"
  | "completed"
  | "failed"
  | "unavailable"
  | "waiting"
  | "queued"
  | "idle";
export interface SyncItem {
  readonly id: string;
  readonly label: string;
  readonly state: SyncState;
  readonly code?: string;
  readonly icon?:
    | "package"
    | "user"
    | "tracking"
    | "money"
    | "file"
    | "layers"
    | "tag"
    | "dispute";
  readonly lastSuccess?: string;
  readonly lastSuccessDisplay?: string;
  readonly progress?: number;
  readonly processed?: number;
  readonly total?: number;
  readonly currentPage?: number;
  readonly totalPages?: number;
  readonly detail?: string;
  readonly errorCode?: string;
  readonly errorTime?: string;
  readonly jobId?: string;
  readonly logs?: readonly string[];
  readonly checkpoint?: string;
  readonly waitingNote?: string;
  readonly autoEnabled?: boolean;
  readonly autoInterval?: string;
  readonly nextRun?: string;
}
export interface SyncHistoryEntry {
  readonly id: string;
  readonly time: string;
  readonly startedAt?: string;
  readonly dataType: string;
  readonly source: string;
  readonly state: SyncState;
  readonly records?: number;
  readonly detail: string;
}
export interface SyncPresentation {
  readonly items: readonly SyncItem[];
  readonly history: readonly SyncHistoryEntry[];
  readonly historyRange?: string;
}
