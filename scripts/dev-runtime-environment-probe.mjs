import { readdirSync, readFileSync, readlinkSync } from "node:fs";
const shared = [
  "CARRIER_KEYRING_JSON",
  "CARRIER_ACTIVE_KEY_VERSION",
  "UNISHIP_API_URL",
  "UNISHIP_LIVE_AUTHORIZED",
  "UNISHIP_ACTIVATION_POLICY_JSON",
  "UNISHIP_RECONCILIATION_POLICY_JSON",
  "SYNC_ENABLED",
  "SYNC_LEASE_SECONDS",
  "SYNC_POLL_MS",
  "SYNC_MAX_ATTEMPTS",
  "SYNC_RESOLVED_RETENTION_DAYS",
];
/** Read only the real server/worker process, never the exec shell or watch supervisor. */
export function verifyDevelopmentEnvironment(kind, expected = process.env) {
  if (!["api", "sync-worker"].includes(kind)) throw Error("DEV_ENV_PROBE_KIND");
  const port = Number(expected.PORT ?? 4000)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");
  const listeners = new Set();
  if (kind === "api") {
    for (const table of ["tcp", "tcp6"]) {
      for (const line of readFileSync(`/proc/net/${table}`, "utf8")
        .trim()
        .split("\n")
        .slice(1)) {
        const fields = line.trim().split(/\s+/);
        if (fields[1].split(":").at(-1) === port && fields[3] === "0A")
          listeners.add(fields[9]);
      }
    }
  }
  const candidates = [];
  for (const pid of readdirSync("/proc").filter((value) =>
    /^\d+$/.test(value),
  )) {
    try {
      const args = readFileSync(`/proc/${pid}/cmdline`, "utf8")
        .split("\0")
        .filter(Boolean);
      if (
        !args[0]?.split("/").at(-1).startsWith("node") ||
        args.includes("--watch")
      )
        continue;
      const entry =
        kind === "api" ? "dist/main.js" : "apps/api/dist/worker/main.js";
      if (!args.some((arg) => arg === entry || arg.endsWith(`/${entry}`)))
        continue;
      if (
        kind === "api" &&
        !readdirSync(`/proc/${pid}/fd`).some((fd) => {
          try {
            return listeners.has(
              readlinkSync(`/proc/${pid}/fd/${fd}`).replace(
                /^socket:\[(\d+)\]$/,
                "$1",
              ),
            );
          } catch {
            return false;
          }
        })
      )
        continue;
      candidates.push(pid);
    } catch {
      /* Unrelated process may exit or belong to another user. */
    }
  }
  if (candidates.length !== 1) throw Error("DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE");
  const env = Object.fromEntries(
    readFileSync(`/proc/${candidates[0]}/environ`, "utf8")
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const offset = entry.indexOf("=");
        return [entry.slice(0, offset), entry.slice(offset + 1)];
      }),
  );
  const keys =
    kind === "api"
      ? [...shared, "TSC_WATCHFILE", "TSC_WATCHDIRECTORY"]
      : shared;
  if (
    !keys.every(
      (key) => expected[key] !== undefined && env[key] === expected[key],
    )
  )
    throw Error("DEV_ENV_PROPAGATION_MISMATCH");
  if (kind === "sync-worker") {
    if (
      ["IDENTITY_KEYRING_JSON", "IDENTITY_ACTIVE_KEY_VERSION"].some(
        (key) => env[key] !== undefined,
      )
    )
      throw Error("DEV_ENV_WORKER_IDENTITY_EXPOSURE");
    if (new URL(env.DATABASE_URL).username !== "nexora_sync")
      throw Error("DEV_ENV_WORKER_ROLE");
  }
  return {
    actualProcess: true,
    runtimeEnvironmentEqual: true,
    workerIdentityAbsent: kind === "sync-worker",
  };
}
