// Invoked by the existing migrated, owned PostgreSQL Sync integration suite.
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const databaseRequire = createRequire(require.resolve("@nexora/database"));
const { Client } = databaseRequire("pg");

module.exports.verifyProviderLengthContract = async ({ t, url }) => {
  const {
    CARRIER_PROVIDER_MAX_LENGTH,
  } = require("../../dist/carrier/domain/carrier");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await t.test(
      "provider columns match CARRIER_PROVIDER_MAX_LENGTH",
      async () => {
        const { rows } = await client.query(
          `SELECT table_name, data_type, character_maximum_length
         FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name = 'provider'
         ORDER BY table_name`,
        );
        assert.deepEqual(
          rows.map((row) => row.table_name),
          [
            "carrier_connections",
            "security_audit_events",
            "sync_jobs",
            "sync_provider_budget",
            "sync_source_identities",
          ],
          "New tables with a provider column must be added to this exact list and use the same provider length",
        );
        assert.equal(CARRIER_PROVIDER_MAX_LENGTH, 32);
        for (const row of rows) {
          assert.equal(
            row.data_type,
            "character varying",
            `${row.table_name}.provider must remain character varying`,
          );
          assert.equal(
            row.character_maximum_length,
            CARRIER_PROVIDER_MAX_LENGTH,
            `${row.table_name}.provider must use the shared provider length`,
          );
        }
      },
    );
  } finally {
    await client.end();
  }
};
