import type { SyncDomainSession } from "../../sync/application/sync.port";

/** Customer-owned capability; never part of the generic Sync session/source. */
export interface CustomerSyncSession extends SyncDomainSession {
  readonly existingCustomerId: string | null;
  linkExistingCustomer(id: string): Promise<void>;
}
