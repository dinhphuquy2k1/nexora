import { Prisma } from "@nexora/database";
import type { SyncJob } from "../../../sync/application/sync.port";
import { SyncType } from "../../../sync/domain/sync.constants";

/** Exact scoped expressions shared with the disposable EXPLAIN benchmark. */
export function shipmentReconciliationQueries(job: SyncJob, scheme: string) {
  // Scope binds owner, provider, account, sync type, and key scheme to prevent cross-tenant or cross-scheme leakage.
  const source = Prisma.sql`
    s.owner_user_id = ${job.owner_user_id}::uuid
    AND s.provider = ${job.provider}
    AND s.external_account_id = ${job.external_account_id}
    AND s.sync_type = ${SyncType.SHIPMENT}
    AND s.source_key_scheme = ${scheme}
  `;

  const scope = Prisma.sql`
    ${source}
    AND p.owner_user_id = ${job.owner_user_id}::uuid
    AND p.provider = ${job.provider}
  `;

  const seen = Prisma.sql`
    SELECT DISTINCT u.id
    FROM sync_job_seen_pages pages
    CROSS JOIN LATERAL unnest(pages.source_identity_ids) u(id)
    WHERE pages.job_id = ${job.id}::uuid
  `;

  const candidates = Prisma.sql`
    SELECT
      p.id,
      p.source_identity_id,
      p.sync_hidden_at,
      p.missing_streak,
      p.carrier_connection_id
    FROM sync_source_identities s
    JOIN shipments p
      ON p.source_identity_id = s.id
    WHERE ${scope}
  `;

  const missing = Prisma.sql`
    WITH seen AS MATERIALIZED (
      ${seen}
    )
    SELECT p.id
    FROM sync_source_identities s
    JOIN shipments p
      ON p.source_identity_id = s.id
    WHERE ${scope}
      AND NOT EXISTS (
        SELECT 1
        FROM seen v
        WHERE v.id = s.id
      )
  `;

  const restore = Prisma.sql`
    WITH seen AS MATERIALIZED (
      ${seen}
    )
    SELECT p.id
    FROM sync_source_identities s
    JOIN shipments p
      ON p.source_identity_id = s.id
    WHERE ${scope}
      AND p.sync_hidden_at IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM seen v
        WHERE v.id = s.id
      )
  `;

  return {
    // Lock source identities in deterministic s.id order before reading shipments.
    sourceLocks: Prisma.sql`
      WITH locked AS MATERIALIZED (
        SELECT s.id
        FROM sync_source_identities s
        WHERE ${source}
        ORDER BY s.id
        FOR UPDATE OF s
      )
      SELECT count(*)::int AS count
      FROM locked
    `,
    conflicts: Prisma.sql`
      SELECT count(*)::int AS count
      FROM sync_source_identities s
      JOIN shipments p
        ON p.source_identity_id = s.id
      WHERE ${source}
        AND (
          p.owner_user_id <> ${job.owner_user_id}::uuid
          OR p.provider IS DISTINCT FROM ${job.provider}
          OR (
            p.carrier_connection_id IS NOT NULL
            AND p.carrier_connection_id <> ${job.carrier_connection_id}::uuid
          )
        )
    `,
    candidates,
    missing,
    restore,
    // Lock candidate shipments in deterministic p.id order after source locks.
    facts: Prisma.sql`
      WITH seen AS MATERIALIZED (
        ${seen}
      ),
      candidates AS MATERIALIZED (
        ${candidates}
        ORDER BY p.id
        FOR UPDATE OF p
      )
      SELECT
        count(*)::int AS "eligibleShipments",
        count(*) FILTER (WHERE c.sync_hidden_at IS NULL)::int AS "currentlyVisible",
        count(*) FILTER (WHERE c.sync_hidden_at IS NULL AND v.id IS NULL)::int AS "newlyMissing",
        count(*) FILTER (WHERE c.sync_hidden_at IS NOT NULL AND v.id IS NULL)::int AS "alreadyHiddenMissing",
        count(*) FILTER (WHERE c.sync_hidden_at IS NOT NULL AND v.id IS NOT NULL)::int AS restorable,
        coalesce(max(c.missing_streak) FILTER (WHERE v.id IS NULL), 0)::int AS "maxMissingStreak"
      FROM candidates c
      LEFT JOIN seen v
        ON v.id = c.source_identity_id
    `,
    // clock_timestamp() records exact commit-time hide timestamp.
    mutation: Prisma.sql`
      WITH seen AS MATERIALIZED (
        ${seen}
      ),
      changes AS MATERIALIZED (
        SELECT
          p.id,
          p.sync_hidden_at AS old_hidden,
          (v.id IS NOT NULL) AS present
        FROM sync_source_identities s
        JOIN shipments p
          ON p.source_identity_id = s.id
        LEFT JOIN seen v
          ON v.id = s.id
        WHERE ${scope}
          AND (
            v.id IS NULL
            OR p.sync_hidden_at IS NOT NULL
          )
      ),
      changed AS (
        UPDATE shipments p
        SET
          sync_hidden_at = CASE
            WHEN c.present THEN NULL
            ELSE coalesce(p.sync_hidden_at, clock_timestamp())
          END,
          missing_streak = CASE
            WHEN c.present THEN 0
            ELSE p.missing_streak + 1
          END
        FROM changes c
        WHERE p.id = c.id
        RETURNING
          c.old_hidden,
          c.present
      )
      SELECT
        count(*) FILTER (WHERE NOT present AND old_hidden IS NULL)::int AS "newlyHidden",
        count(*) FILTER (WHERE present)::int AS restored,
        count(*) FILTER (WHERE NOT present AND old_hidden IS NOT NULL)::int AS "stillMissing"
      FROM changed
    `,
  };
}
