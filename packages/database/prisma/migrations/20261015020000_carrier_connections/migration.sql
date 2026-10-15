BEGIN;
CREATE TABLE "carrier_connections" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL,
 "provider" VARCHAR(32) NOT NULL, "external_account_id" VARCHAR(128) NOT NULL,
 "login_identifier" VARCHAR(128), "display_name" VARCHAR(100) NOT NULL,
 "status" VARCHAR(32) NOT NULL, "last_verified_at" TIMESTAMPTZ(3),
 "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "carrier_connections_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "uq_carrier_connections_provider_account" UNIQUE ("provider","external_account_id"),
 CONSTRAINT "chk_carrier_connections_provider" CHECK (provider IN ('uniship')),
 CONSTRAINT "chk_carrier_connections_status" CHECK (status IN ('CONNECTED','REAUTH_REQUIRED','ERROR')),
 CONSTRAINT "carrier_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "idx_carrier_connections_user_provider" ON "carrier_connections"("user_id","provider");
CREATE TABLE "carrier_connection_secrets" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "connection_id" UUID NOT NULL,
 "secret_type" VARCHAR(32) NOT NULL, "ciphertext" TEXT NOT NULL,
 "nonce" VARCHAR(64) NOT NULL, "auth_tag" VARCHAR(64) NOT NULL, "key_version" INTEGER NOT NULL,
 "expires_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "carrier_connection_secrets_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "uq_carrier_secrets_connection_type" UNIQUE ("connection_id","secret_type"),
 CONSTRAINT "chk_carrier_secrets_type" CHECK (secret_type IN ('ACCESS_TOKEN','REFRESH_TOKEN','PASSWORD')),
 CONSTRAINT "carrier_connection_secrets_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "carrier_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
COMMIT;
