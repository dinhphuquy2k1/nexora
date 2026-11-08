import type { SyncDomainProcessor, SyncProvider } from "./sync.port";
import type { SyncType } from "../domain/sync.constants";

export interface SyncCapability {
  readonly provider: SyncProvider;
  readonly processor: Pick<SyncDomainProcessor, "version" | "supports">;
}
export interface SyncCapabilityResolver {
  resolve(provider: string, type: SyncType): SyncCapability | null;
}
