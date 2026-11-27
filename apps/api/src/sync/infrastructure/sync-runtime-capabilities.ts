import { CarrierProvider } from "../../carrier/domain/carrier";
import { SyncType } from "../domain/sync.constants";
import type { SyncProvider } from "../application/sync.port";
import type { SyncDomainBinding } from "./sync-domain.binding";
import {
  SyncCapabilityRegistry,
  type SyncCapabilityRegistration,
} from "./sync-capability.registry";
export interface SyncRuntimeDependencies {
  readonly provider: SyncProvider;
  readonly domain: SyncDomainBinding;
  readonly enabled: boolean;
}
/** One explicit declaration source; runtime scope eligibility remains separate. */
export function createSyncRuntimeCapabilities(
  dependencies?: SyncRuntimeDependencies,
): SyncCapabilityRegistry {
  const registrations: readonly SyncCapabilityRegistration[] =
    dependencies?.enabled
      ? Object.freeze([
          Object.freeze({
            providerName: CarrierProvider.UNISHIP,
            type: SyncType.SHIPMENT,
            provider: dependencies.provider,
            domain: dependencies.domain,
          }),
        ])
      : Object.freeze([]);
  return new SyncCapabilityRegistry(registrations);
}
