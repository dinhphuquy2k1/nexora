-- CreateTable external_identities
BEGIN;

CREATE TABLE "external_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "provider_subject" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "external_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "external_identities_provider_check" CHECK ("provider" IN ('uniship')),
    CONSTRAINT "external_identities_provider_subject_check" CHECK (length(trim("provider_subject")) > 0 AND "provider_subject" = trim("provider_subject"))
);

-- CreateIndex
CREATE UNIQUE INDEX "external_identities_provider_provider_subject_key" ON "external_identities"("provider", "provider_subject");

-- CreateIndex
CREATE UNIQUE INDEX "external_identities_user_id_provider_key" ON "external_identities"("user_id", "provider");

-- CreateIndex
CREATE INDEX "external_identities_user_id_idx" ON "external_identities"("user_id");

COMMIT;
