// Independent test-only requirements; never derive expected values from Turbo/Compose.
export const IDENTITY_ENV = Object.freeze([
  "IDENTITY_KEYRING_JSON",
  "IDENTITY_ACTIVE_KEY_VERSION",
]);
export const CARRIER_UNISHIP_ENV = Object.freeze([
  "CARRIER_KEYRING_JSON",
  "CARRIER_ACTIVE_KEY_VERSION",
  "UNISHIP_API_URL",
  "UNISHIP_LIVE_AUTHORIZED",
  "UNISHIP_ACTIVATION_POLICY_JSON",
  "UNISHIP_RECONCILIATION_POLICY_JSON",
]);
export const SYNC_ENV = Object.freeze([
  "SYNC_ENABLED",
  "SYNC_LEASE_SECONDS",
  "SYNC_POLL_MS",
  "SYNC_MAX_ATTEMPTS",
  "SYNC_RESOLVED_RETENTION_DAYS",
]);
export const API_ORIGIN_ENV = Object.freeze(["WEB_PORT", "ALLOWED_ORIGINS"]);
export const TSC_WATCH_ENV = Object.freeze([
  "TSC_WATCHFILE",
  "TSC_WATCHDIRECTORY",
]);
export const SHARED_RUNTIME_ENV = Object.freeze([
  ...CARRIER_UNISHIP_ENV,
  ...SYNC_ENV,
]);
export const API_DEV_PASSTHROUGH_ENV = Object.freeze([
  ...IDENTITY_ENV,
  ...SHARED_RUNTIME_ENV,
  ...API_ORIGIN_ENV,
  ...TSC_WATCH_ENV,
]);
export const SYNC_COMPOSE_DEFAULTS = Object.freeze({
  SYNC_ENABLED: "false",
  SYNC_LEASE_SECONDS: "60",
  SYNC_POLL_MS: "1000",
  SYNC_MAX_ATTEMPTS: "5",
  SYNC_RESOLVED_RETENTION_DAYS: "",
});
export const EXISTING_GLOBAL_ENV = Object.freeze([
  "DATABASE_URL",
  "STORAGE_ROOT",
  "API_DOCS_ENABLED",
  "PORT",
  "NODE_ENV",
  "API_INTERNAL_URL",
  "NEXT_TELEMETRY_DISABLED",
]);
