import { Prisma } from "@nexora/database";
/** Fixed SQL operation; atomic credential/audit CAS stays inside the scoped function. */
export function buildCompleteWorkerRecoveryQuery(params: {
  jobId: string;
  workerId: string | null;
  leaseVersion: number;
  operationToken: string;
  version: number;
  externalAccountId: string;
  passwordCiphertext: string;
  passwordNonce: string;
  passwordAuthTag: string;
  passwordKeyVersion: number;
  tokenCiphertext: string;
  tokenNonce: string;
  tokenAuthTag: string;
  tokenKeyVersion: number;
  expiresAt: Date | null;
  correlationId: string;
}): Prisma.Sql {
  return Prisma.sql`
          SELECT
            public.sync_carrier_complete(${params.jobId}::uuid,
              ${params.workerId}::uuid,
              ${params.leaseVersion},
              ${params.operationToken}::uuid,
              ${params.version},
              ${params.externalAccountId}::varchar,
              ${params.passwordCiphertext},
              ${params.passwordNonce}::varchar,
              ${params.passwordAuthTag}::varchar,
              ${params.passwordKeyVersion},
              ${params.tokenCiphertext},
              ${params.tokenNonce}::varchar,
              ${params.tokenAuthTag}::varchar,
              ${params.tokenKeyVersion},
              ${params.expiresAt}::timestamptz,
              ${params.correlationId}::uuid) AS result
          `;
}
