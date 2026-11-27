import { buildUnishipJobCandidatesQuery } from "./queries/uniship-runtime.queries";
import { Prisma } from "@nexora/database";
import { CarrierProvider } from "../../carrier/domain/carrier";
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
  const jobCandidates = buildUnishipJobCandidatesQuery(scope, automatic);
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
      // DB clock checks admission due-ness while existing connection locks preserve scope.
      const [row] = await tx.$queryRaw<
        {
          login_identifier: string | null;
          interval_minutes: number | null;
          enabled: boolean | null;
          due: boolean | null;
        }[]
      >`
        SELECT
          c.login_identifier,
          s.interval_minutes,
          s.enabled,
          (s.next_run_at<=clock_timestamp()) AS due
        FROM carrier_connections c
        LEFT JOIN sync_configs s
          ON s.carrier_connection_id=c.id
          AND s.sync_type=${type}
        WHERE c.id=${c.id}::uuid
          AND c.user_id=${c.user_id}::uuid
      `;
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
