import { SyncType } from "@nexora/shared/sync-status";
import { CarrierProvider } from "./carrier";

export interface DefaultSyncPolicy {
  readonly syncType: SyncType;
  readonly enabled: boolean;
  readonly intervalMinutes: number;
}
const unishipDefaults: readonly DefaultSyncPolicy[] = Object.freeze([
  Object.freeze({
    syncType: SyncType.SHIPMENT,
    enabled: true,
    intervalMinutes: 60,
  }),
]);
const noDefaults: readonly DefaultSyncPolicy[] = Object.freeze([]);
/** Onboarding defaults are persisted intent, never executable capability registration. */
export function getDefaultSyncPolicies(
  provider: string,
): readonly DefaultSyncPolicy[] {
  return provider === CarrierProvider.UNISHIP ? unishipDefaults : noDefaults;
}
