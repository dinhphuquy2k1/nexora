import { SyncType } from "@nexora/shared/sync-status";
import { CarrierProvider } from "./carrier";

export interface DefaultSyncPolicy {
  readonly syncType: SyncType;
  readonly enabled: boolean;
  readonly intervalMinutes: number;
}
const EMPTY_POLICIES: readonly DefaultSyncPolicy[] = Object.freeze([]);
const DEFAULT_POLICIES = Object.freeze({
  [CarrierProvider.UNISHIP]: Object.freeze([
    Object.freeze({
      syncType: SyncType.SHIPMENT,
      enabled: true,
      intervalMinutes: 60,
    }),
  ]),
}) satisfies Readonly<
  Partial<Record<CarrierProvider, readonly DefaultSyncPolicy[]>>
>;
/** Onboarding defaults are persisted intent, never executable capability registration. */
export function getDefaultSyncPolicies(
  provider: string,
): readonly DefaultSyncPolicy[] {
  if (!Object.hasOwn(DEFAULT_POLICIES, provider)) return EMPTY_POLICIES;
  return (
    DEFAULT_POLICIES[provider as keyof typeof DEFAULT_POLICIES] ??
    EMPTY_POLICIES
  );
}
