-- Legacy ADMIN mapping is approved only for the supported trusted CLI provenance.
-- Prisma bookkeeping is outside this explicit application-data transaction.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='local_users' AND column_name='is_active' AND data_type='boolean') THEN
    RAISE EXCEPTION 'Unexpected legacy identity schema';
  END IF;
END $$;
CREATE TEMP TABLE nexora_identity_before ON COMMIT DROP AS TABLE "local_users";
CREATE TEMP TABLE nexora_sessions_before ON COMMIT DROP AS TABLE "sessions";
ALTER TABLE "local_users" RENAME TO "users";
ALTER TABLE "users" RENAME CONSTRAINT "local_users_pkey" TO "users_pkey";
ALTER INDEX "local_users_username_key" RENAME TO "users_username_key";
ALTER TABLE "users" ADD COLUMN "role" VARCHAR(16);
UPDATE "users" SET "role"='ADMIN';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "role" IS NULL) THEN RAISE EXCEPTION 'Incomplete role mapping'; END IF;
END $$;
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('ADMIN','OPERATOR'));
ALTER TABLE "users" ADD COLUMN "status" VARCHAR(16);
UPDATE "users" SET "status"=CASE WHEN "is_active" THEN 'ACTIVE' ELSE 'DISABLED' END;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "status" IS NULL OR "status" NOT IN ('ACTIVE','DISABLED')) THEN RAISE EXCEPTION 'Incomplete status mapping'; END IF;
END $$;
ALTER TABLE "users" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD CONSTRAINT "users_status_check" CHECK ("status" IN ('ACTIVE','DISABLED'));
CREATE TABLE "user_credentials" (
  "user_id" UUID NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "user_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "user_credentials" ("user_id","password_hash") SELECT "id","password_hash" FROM "users";
-- FAILURE_INJECTION_POINT: test only a temporary copy after extraction.
DO $$ BEGIN
  IF (SELECT count(*) FROM "user_credentials") <> (SELECT count(*) FROM nexora_identity_before)
    OR (SELECT count(*) FROM "users") <> (SELECT count(*) FROM nexora_identity_before)
    OR EXISTS (SELECT 1 FROM nexora_identity_before b LEFT JOIN "users" u ON u.id=b.id LEFT JOIN "user_credentials" c ON c.user_id=b.id
      WHERE u.id IS NULL OR c.user_id IS NULL
        OR convert_to(c.password_hash,'UTF8') IS DISTINCT FROM convert_to(b.password_hash,'UTF8')
        OR u.username IS DISTINCT FROM b.username OR u.created_at IS DISTINCT FROM b.created_at OR u.updated_at IS DISTINCT FROM b.updated_at
        OR u.role <> 'ADMIN' OR u.status <> CASE WHEN b.is_active THEN 'ACTIVE' ELSE 'DISABLED' END)
    OR EXISTS (SELECT 1 FROM "user_credentials" c LEFT JOIN "users" u ON u.id=c.user_id WHERE u.id IS NULL)
  THEN RAISE EXCEPTION 'Identity preservation check failed'; END IF;
  IF EXISTS ((SELECT * FROM "sessions" EXCEPT SELECT * FROM nexora_sessions_before) UNION ALL (SELECT * FROM nexora_sessions_before EXCEPT SELECT * FROM "sessions"))
    OR EXISTS (SELECT 1 FROM "sessions" s LEFT JOIN "users" u ON u.id=s.user_id WHERE u.id IS NULL)
  THEN RAISE EXCEPTION 'Session preservation check failed'; END IF;
END $$;
ALTER TABLE "users" DROP COLUMN "password_hash", DROP COLUMN "is_active";
COMMIT;
