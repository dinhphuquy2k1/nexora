import { Prisma } from "@nexora/database";
import {
  CarrierProvider,
  ConnectionStatus,
} from "../../carrier/domain/carrier";
import { UserStatus } from "../../identity/domain/user-policy";
import { SyncType, SyncTrigger } from "../domain/sync.constants";
import {
  allowsUnishipActivation,
  UnishipActivationMode,
  type UnishipActivationPolicy,
} from "./uniship-sync.config";
import type {
  SyncRuntimePolicy,
  SyncRuntimeConnection,
} from "./sync-runtime-policy";
export function createUnishipRuntimePolicy(
  policy: UnishipActivationPolicy | undefined,
  enabled: boolean,
): SyncRuntimePolicy {
  const active = enabled && policy !== undefined;
  const automatic = active && policy?.mode === UnishipActivationMode.AUTOMATIC;
  const scope = active
    ? Prisma.sql`c.user_id=${policy.ownerUserId}::uuid AND c.provider=${CarrierProvider.UNISHIP}
  AND c.external_account_id=${policy.externalAccountId} AND c.login_identifier=${policy.loginIdentifier}
  AND (${policy.connectionId ?? null}::uuid IS NULL OR c.id=${policy.connectionId ?? null}::uuid)`
    : Prisma.sql`FALSE`;
  const scheduleCandidates = Prisma.sql`(${automatic} AND ${scope} AND s.sync_type=${SyncType.SHIPMENT} AND s.interval_minutes>=60)`;
  const jobCandidates = Prisma.sql`EXISTS(SELECT 1 FROM carrier_connections c JOIN users u ON u.id=c.user_id
  LEFT JOIN sync_configs s ON s.carrier_connection_id=c.id AND s.sync_type=j.sync_type
  WHERE c.id=j.carrier_connection_id AND c.user_id=j.owner_user_id AND ${scope}
   AND j.provider=c.provider AND j.external_account_id=c.external_account_id AND j.sync_type=${SyncType.SHIPMENT}
   AND u.status=${UserStatus.ACTIVE} AND c.status=${ConnectionStatus.CONNECTED}
   AND (j.trigger_source=${SyncTrigger.MANUAL} OR (${automatic} AND j.trigger_source=${SyncTrigger.AUTO} AND s.interval_minutes>=60)))`;
  return Object.freeze({
    jobCandidates,
    scheduleCandidates,
    async accepts(
      tx: Prisma.TransactionClient,
      c: SyncRuntimeConnection,
      type: SyncType,
      trigger: string,
      phase: "admit" | "execute",
    ) {
      if (!active || type !== SyncType.SHIPMENT) return false;
      const [row] = await tx.$queryRaw<
        {
          login_identifier: string | null;
          interval_minutes: number | null;
          enabled: boolean | null;
          due: boolean | null;
        }[]
      >`
   SELECT c.login_identifier,s.interval_minutes,s.enabled,(s.next_run_at<=clock_timestamp()) AS due
   FROM carrier_connections c LEFT JOIN sync_configs s ON s.carrier_connection_id=c.id AND s.sync_type=${type}
   WHERE c.id=${c.id}::uuid AND c.user_id=${c.user_id}::uuid`;
      if (
        !row ||
        !allowsUnishipActivation(
          policy,
          {
            ownerUserId: c.user_id,
            connectionId: c.id,
            provider: c.provider,
            externalAccountId: c.external_account_id,
            loginIdentifier: row.login_identifier,
          },
          trigger,
          row.interval_minutes ?? undefined,
        )
      )
        return false;
      return (
        trigger !== SyncTrigger.AUTO ||
        phase === "execute" ||
        Boolean(row.enabled && row.due)
      );
    },
  });
}
