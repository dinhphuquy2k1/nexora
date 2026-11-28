import assert from "node:assert/strict";
import { get } from "node:http";

const DIAGNOSTIC_ERROR_TYPES = new Set([
  "AbortError",
  "AssertionError",
  "Error",
  "RangeError",
  "SyntaxError",
  "TimeoutError",
  "TypeError",
]);

export function createSmokeChecks(
  write = console.error,
  label = "AUTH_RUNTIME_SMOKE_FAILED",
  { diagnostics = false, now = Date.now } = {},
) {
  let step = "START";
  let stepStarted = now();
  let statuses;
  return {
    step(name) {
      step = name;
      stepStarted = now();
      statuses = undefined;
    },
    requestStarted() {
      statuses = { actual: "NOT_OBSERVED", expected: "NOT_SET" };
    },
    status(actual, expected) {
      statuses = {
        actual: Number.isInteger(actual) ? actual : "NOT_OBSERVED",
        expected: Number.isInteger(expected) ? expected : "NOT_SET",
      };
      assert.equal(actual, expected);
    },
    failure(error) {
      const code = error?.cause?.code ?? error?.code;
      const category = ["EAI_AGAIN", "ENOTFOUND"].includes(code)
        ? "DNS_FAILURE"
        : code === "ECONNREFUSED"
          ? "CONNECTION_REFUSED"
          : ["AbortError", "TimeoutError"].includes(error?.name)
            ? "REQUEST_TIMEOUT"
            : code === "DOCKER_TIMEOUT"
              ? "DOCKER_TIMEOUT"
              : code === "DOCKER_FAILURE"
                ? "DOCKER_FAILURE"
                : error?.name === "AssertionError"
                  ? "ASSERTION_FAILED"
                  : [
                        "SELECTOR_NOT_FOUND",
                        "CONTROL_DISABLED",
                        "FOCUS_MISMATCH",
                        "PROTOCOL_EXCEPTION",
                        "VALUE_MISMATCH",
                      ].includes(code)
                    ? code
                    : "CHECK_FAILED";
      write(label);
      write(`Step: ${step}`);
      if (statuses) {
        write(`Expected HTTP status: ${statuses.expected}`);
        write(`Actual HTTP status: ${statuses.actual}`);
      }
      write(`Category: ${category}`);
      if (diagnostics) {
        const type =
          typeof error?.name === "string" &&
          DIAGNOSTIC_ERROR_TYPES.has(error.name)
            ? error.name
            : "OTHER";
        write(`Error type: ${type}`);
        write(
          `Step elapsed ms: ${Math.max(0, Math.round(now() - stepStarted))}`,
        );
      }
    },
  };
}

/** Node fetch rewrites Host; use raw HTTP for the actual ingress-negative probe. */
export function hostStatus(url, host) {
  return new Promise((resolve, reject) => {
    const request = get(url, { headers: { host } }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode));
      response.once("error", reject);
    });
    request.setTimeout(10000, () =>
      request.destroy(
        Object.assign(new Error("Host probe timeout"), {
          name: "TimeoutError",
        }),
      ),
    );
    request.once("error", reject);
  });
}

export function untrustedHostStatus(url) {
  return hostStatus(url, "evil.example");
}

const COMPOSE_STATES = new Set([
  "created",
  "running",
  "restarting",
  "paused",
  "exited",
  "dead",
  "removing",
]);
const COMPOSE_HEALTH = new Set(["healthy", "unhealthy", "starting"]);
const KNOWN_COMPOSE_SERVICES = new Set([
  "builder",
  "init",
  "postgres",
  "dependencies",
  "migrate",
  "db-runtime",
  "api",
  "sync-worker",
  "web",
  "ingress",
]);
const DEV_SMOKE_PHASES = new Set([
  "START",
  "BOOTSTRAP",
  "DEPENDENCY_REBUILD",
  "INITIAL_RUNTIME_PROBE",
  "DEV_UNENROLLED_ADMIN_DENIAL",
  "MFA_ENROLLMENT_AND_HTTP_SMOKE",
  "RESTART_RECOVERY",
  "RECREATE_API_PRECHECK",
  "RECREATE_API_WITH_EXPLICIT_ORIGIN",
  "RECREATE_API_RUNTIME_PROBE",
  "HMR_PROPAGATION",
  "DATA_PERSISTENCE",
]);

/** Project `compose ps -a --format json` strictly to sanitized fixed service state fields. */
export function summarizeComposeServices(psJsonOutput) {
  try {
    if (typeof psJsonOutput !== "string" || !psJsonOutput.trim()) {
      return { available: false, services: [] };
    }
    const trimmed = psJsonOutput.trim();
    const rows = trimmed.startsWith("[")
      ? JSON.parse(trimmed)
      : trimmed
          .split(/\r?\n/)
          .filter((line) => line.trim().length > 0)
          .map((line) => JSON.parse(line));
    if (!Array.isArray(rows)) return { available: false, services: [] };
    const services = [];
    for (const row of rows.slice(0, 32)) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return { available: false, services: [] };
      }
      const rawService = typeof row.Service === "string" ? row.Service : "";
      const service = KNOWN_COMPOSE_SERVICES.has(rawService)
        ? rawService
        : "other";
      const rawState =
        typeof row.State === "string" ? row.State.toLowerCase() : "";
      const state = COMPOSE_STATES.has(rawState) ? rawState : "unknown";
      const rawHealth =
        typeof row.Health === "string" ? row.Health.toLowerCase() : "";
      const health = COMPOSE_HEALTH.has(rawHealth) ? rawHealth : "unknown";
      const exitCode = Number.isInteger(row.ExitCode) ? row.ExitCode : null;
      services.push({ service, state, health, exitCode });
    }
    return { available: true, services };
  } catch {
    return { available: false, services: [] };
  }
}

/** Fail-closed check before `compose up --no-deps --force-recreate api`. */
export function verifyDevSmokeDependenciesReady(
  psJsonOutput,
  requiredServices = ["postgres", "dependencies", "migrate", "db-runtime"],
) {
  const summary = summarizeComposeServices(psJsonOutput);
  if (!summary.available) {
    return { ready: false, failedServices: ["UNAVAILABLE"], services: [] };
  }
  const byName = new Map(summary.services.map((s) => [s.service, s]));
  const failedServices = [];
  for (const name of requiredServices) {
    const entry = byName.get(name);
    if (!entry) {
      failedServices.push(name);
      continue;
    }
    if (name === "postgres") {
      if (entry.state !== "running" || entry.health !== "healthy") {
        failedServices.push(name);
      }
    } else if (entry.state !== "exited" || entry.exitCode !== 0) {
      failedServices.push(name);
    }
  }
  return {
    ready: failedServices.length === 0,
    failedServices,
    services: summary.services,
  };
}

/** Build sanitized `DEV_SMOKE_DIAGNOSTIC` payload without logs, URLs, or secrets. */
export function formatDevSmokeFailure({
  phase,
  phaseElapsedMs,
  servicesSummary,
  apiListenerPresent = null,
  liveStatus = null,
  readyChecks = null,
} = {}) {
  const safePhase = DEV_SMOKE_PHASES.has(phase) ? phase : "UNKNOWN";
  const safeElapsed =
    typeof phaseElapsedMs === "number" && Number.isFinite(phaseElapsedMs)
      ? Math.max(0, Math.round(phaseElapsedMs))
      : null;
  const readyStatus = Number.isInteger(readyChecks?.status)
    ? readyChecks.status
    : null;
  return {
    phase: safePhase,
    phaseElapsedMs: safeElapsed,
    services: Array.isArray(servicesSummary?.services)
      ? servicesSummary.services
      : [],
    apiListenerPresent:
      typeof apiListenerPresent === "boolean" ? apiListenerPresent : null,
    liveStatus: Number.isInteger(liveStatus) ? liveStatus : null,
    readyStatus,
    databaseReady:
      typeof readyChecks?.database === "boolean" ? readyChecks.database : null,
    storageReady:
      typeof readyChecks?.storage === "boolean" ? readyChecks.storage : null,
  };
}
