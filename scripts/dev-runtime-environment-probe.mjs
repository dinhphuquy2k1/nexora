import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import {
  SHARED_RUNTIME_ENV,
  API_DEV_PASSTHROUGH_ENV,
  IDENTITY_ENV,
} from "./helpers/runtime-environment-contract.mjs";
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
  const keys = kind === "api" ? API_DEV_PASSTHROUGH_ENV : SHARED_RUNTIME_ENV;
  const mismatched = keys.filter(
    (key) => expected[key] === undefined || env[key] !== expected[key],
  );
  if (mismatched.length)
    throw Error("DEV_ENV_PROPAGATION_MISMATCH:" + mismatched.join(","));
  if (
    kind === "sync-worker" &&
    IDENTITY_ENV.some((key) => env[key] !== undefined)
  )
    throw Error("DEV_ENV_WORKER_IDENTITY_EXPOSURE");
  if (kind === "api" && IDENTITY_ENV.some((key) => !env[key]))
    throw Error("DEV_ENV_API_IDENTITY_MISSING");
  let roleMatches = false;
  try {
    roleMatches =
      new URL(env.DATABASE_URL).username ===
      (kind === "api" ? "nexora_app" : "nexora_sync");
  } catch {
    /* Never include URL in diagnostics. */
  }
  if (!roleMatches) throw Error("DEV_ENV_DATABASE_ROLE");
  return {
    actualProcess: true,
    runtimeEnvironmentEqual: true,
    workerIdentityAbsent: kind === "sync-worker",
    apiIdentityPresent: kind === "api",
    databaseRoleMatches: true,
  };
}
