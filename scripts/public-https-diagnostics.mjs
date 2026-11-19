import { spawn, spawnSync } from "node:child_process";
import { setTimeout, clearTimeout } from "node:timers";
import { terminateChildProcess } from "./browser-teardown.mjs";
import { isUuid } from "../packages/shared/src/validation/uuid.ts";

const errors = new Set([
  "net::ERR_ABORTED",
  "net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS",
  "net::ERR_HTTP_1_1_REQUIRED",
  "net::ERR_HTTP2_SERVER_REFUSED_STREAM",
  "net::ERR_FAILED",
  "net::ERR_NETWORK_CHANGED",
  "net::ERR_CONNECTION_CLOSED",
  "net::ERR_CONNECTION_RESET",
  "net::ERR_CONNECTION_REFUSED",
  "net::ERR_EMPTY_RESPONSE",
  "net::ERR_TIMED_OUT",
  "net::ERR_NAME_NOT_RESOLVED",
  "net::ERR_PROXY_CONNECTION_FAILED",
  "net::ERR_TUNNEL_CONNECTION_FAILED",
  "net::ERR_CERT_AUTHORITY_INVALID",
  "net::ERR_CERT_COMMON_NAME_INVALID",
  "net::ERR_CERT_DATE_INVALID",
  "net::ERR_SSL_PROTOCOL_ERROR",
  "net::ERR_ALPN_NEGOTIATION_FAILED",
  "net::ERR_HTTP2_PROTOCOL_ERROR",
  "net::ERR_HTTP2_PING_FAILED",
  "net::ERR_INVALID_HTTP_RESPONSE",
  "net::ERR_CONTENT_LENGTH_MISMATCH",
  "net::ERR_INCOMPLETE_CHUNKED_ENCODING",
  "net::ERR_BLOCKED_BY_CLIENT",
  "net::ERR_BLOCKED_BY_RESPONSE",
  "net::ERR_ADDRESS_UNREACHABLE",
  "net::ERR_INTERNET_DISCONNECTED",
]);
const corsErrors = new Set([
  "InsecurePrivateNetwork",
  "InvalidPrivateNetworkAccess",
  "UnexpectedPrivateNetworkAccess",
  "PrivateNetworkAccessPermissionUnavailable",
  "PrivateNetworkAccessPermissionDenied",
  "PreflightMissingAllowPrivateNetwork",
  "PreflightInvalidAllowPrivateNetwork",
  "AllowOriginMismatch",
  "MissingAllowOriginHeader",
  "WildcardOriginNotAllowed",
]);
const blocked = new Set([
  "other",
  "csp",
  "mixed-content",
  "origin",
  "inspector",
  "subresource-filter",
  "content-type",
  "coep-frame-resource-needs-coep-header",
  "coop-sandboxed-iframe-cannot-navigate-to-coop-page",
  "corp-not-same-origin",
  "corp-not-same-origin-after-defaulted-to-same-origin-by-coep",
  "corp-not-same-site",
]);
const probeErrors = new Map(
  Object.entries({
    ECONNRESET: "CONNECTION_RESET",
    ECONNREFUSED: "CONNECTION_REFUSED",
    ENOTFOUND: "DNS_FAILURE",
    EAI_AGAIN: "DNS_FAILURE",
    ERR_TLS_CERT_ALTNAME_INVALID: "TLS_VALIDATION",
    SELF_SIGNED_CERT_IN_CHAIN: "TLS_VALIDATION",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: "TLS_VALIDATION",
    UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "TLS_VALIDATION",
    CERT_HAS_EXPIRED: "TLS_VALIDATION",
    DEPTH_ZERO_SELF_SIGNED_CERT: "TLS_VALIDATION",
  }),
);
/** Fixed-endpoint diagnostics: opaque CDP IDs stay private; never retain a raw event. */
export function createPublicAuthRequestDiagnostics(
  expectedOrigin,
  now = Date.now,
) {
  const expected = new URL(expectedOrigin);
  if (
    expected.protocol !== "https:" ||
    expected.username ||
    expected.password ||
    expected.search ||
    expected.hash ||
    expected.pathname !== "/"
  )
    throw Error("Invalid diagnostic origin");
  const requests = new Map();
  const scripts = new Map();
  const scriptFailures = [];
  const endpointCounts = new Map();
  let dropped = 0;
  return {
    observe({ method, params = {} }) {
      if (method === "Network.requestWillBeSent") {
        let url;
        try {
          url = new URL(params.request?.url);
        } catch {
          return;
        }
        if (
          url.origin === expected.origin &&
          params.type === "Script" &&
          url.pathname.startsWith("/_next/static/")
        ) {
          if (scripts.size < 16 && !scripts.has(params.requestId))
            scripts.set(params.requestId, { started: now(), terminal: false });
          return;
        }
        if (url.origin !== expected.origin) return;
        let endpoint;
        if (url.pathname === "/api/auth/login") endpoint = "LOGIN";
        else if (params.request.method === "POST") {
          if (url.pathname === "/api/admin/operators")
            endpoint = "OPERATOR_CREATE";
          else {
            const match = url.pathname.match(
              /^\/api\/admin\/operators\/([^/]+)\/setup-link$/,
            );
            if (match && isUuid(match[1])) endpoint = "OPERATOR_SETUP_LINK";
          }
        }
        if (!endpoint) return;
        if (requests.has(params.requestId)) return;
        if ((endpointCounts.get(endpoint) ?? 0) === 4) {
          dropped = Math.min(64, dropped + 1);
          return;
        }
        endpointCounts.set(endpoint, (endpointCounts.get(endpoint) ?? 0) + 1);
        const started = now();
        const origin = Object.entries(params.request.headers ?? {}).find(
          ([key]) => key.toLowerCase() === "origin",
        )?.[1];
        const originHeaderMatches =
          typeof origin === "string" ? origin === expected.origin : null;
        requests.set(params.requestId, {
          started,
          row: {
            ordinal: requests.size + 1,
            endpoint,
            method: ["POST", "GET", "OPTIONS"].includes(params.request.method)
              ? params.request.method
              : "OTHER",
            originHeaderMatches,
            startedUTC: new Date(started).toISOString(),
            elapsedMs: 0,
            responseReceived: false,
            status: null,
            protocol: null,
            peerLoopback: null,
            peerPortMatches: null,
            apiRequestId: null,
            finished: false,
            failed: false,
            networkError: null,
            blockedReason: null,
            canceled: null,
            corsError: null,
          },
        });
        return;
      }
      const script = scripts.get(params.requestId);
      if (script && !script.terminal && method === "Network.loadingFinished")
        script.terminal = true;
      if (script && !script.terminal && method === "Network.loadingFailed") {
        script.terminal = true;
        if (scriptFailures.length < 4)
          scriptFailures.push({
            category: "SAME_ORIGIN_NEXT_SCRIPT",
            failedUTC: new Date(now()).toISOString(),
            elapsedMs: Math.min(
              60000,
              Math.max(0, Math.round(now() - script.started)),
            ),
            networkError: errors.has(params.errorText)
              ? params.errorText
              : "OTHER",
            blockedReason: params.blockedReason
              ? blocked.has(params.blockedReason)
                ? params.blockedReason
                : "OTHER"
              : null,
            corsError: params.corsErrorStatus?.corsError
              ? corsErrors.has(params.corsErrorStatus.corsError)
                ? params.corsErrorStatus.corsError
                : "OTHER"
              : null,
            canceled: params.canceled === true,
          });
      }
      const entry = requests.get(params.requestId);
      if (!entry || entry.row.finished || entry.row.failed) return;
      if (
        ![
          "Network.responseReceived",
          "Network.loadingFinished",
          "Network.loadingFailed",
        ].includes(method)
      )
        return;
      const row = entry.row;
      row.elapsedMs = Math.min(
        60000,
        Math.max(0, Math.round(now() - entry.started)),
      );
      if (method === "Network.responseReceived") {
        const response = params.response ?? {};
        row.responseReceived = true;
        if (
          Number.isInteger(response.status) &&
          response.status >= 100 &&
          response.status <= 599
        )
          row.status = response.status;
        row.protocol = ["h2", "http/1.1", "http/1.0", "h3", "quic"].includes(
          response.protocol,
        )
          ? response.protocol
          : "OTHER";
        row.peerLoopback = ["127.0.0.1", "::1", "[::1]"].includes(
          response.remoteIPAddress,
        );
        row.peerPortMatches =
          response.remotePort === Number(expected.port || 443);
        const id = Object.entries(response.headers ?? {}).find(
          ([key]) => key.toLowerCase() === "x-request-id",
        )?.[1];
        if (isUuid(id)) row.apiRequestId = id.toLowerCase();
      }
      if (method === "Network.loadingFinished") row.finished = true;
      if (method === "Network.loadingFailed") {
        row.failed = true;
        row.networkError = errors.has(params.errorText)
          ? params.errorText
          : "OTHER";
        row.blockedReason = null;
        if (params.blockedReason)
          row.blockedReason = blocked.has(params.blockedReason)
            ? params.blockedReason
            : "OTHER";
        row.canceled = params.canceled === true;
        row.corsError = null;
        if (params.corsErrorStatus?.corsError)
          row.corsError = corsErrors.has(params.corsErrorStatus.corsError)
            ? params.corsErrorStatus.corsError
            : "OTHER";
      }
    },
    snapshot: () => ({
      scriptFailures: scriptFailures.map((row) => ({ ...row })),
      requests: [...requests.values()].map(({ row, started }) => ({
        ...row,
        elapsedMs:
          row.finished || row.failed
            ? row.elapsedMs
            : Math.min(60000, Math.max(0, Math.round(now() - started))),
      })),
      dropped,
    }),
  };
}

/** Only the disposable overlay calls this; production keeps access_log off. */
export function publicAuthIngressTemplate(template) {
  const marker = "  access_log off;";
  if (template.split(marker).length !== 2)
    throw Error("Unexpected ingress diagnostic template");
  return template.replace(
    marker,
    () => `  # BEGIN disposable auth diagnostics
  map "$request_method:$uri" $nexora_auth_endpoint {
    default "";
    "POST:/api/auth/login" LOGIN;
    "POST:/api/admin/operators" OPERATOR_CREATE;
    "~^POST:/api/admin/operators/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/setup-link$" OPERATOR_SETUP_LINK;
  }
  map $nexora_auth_endpoint $nexora_auth_trace {
    default 1;
    "" 0;
  }
  log_format nexora_auth_trace escape=json '{"event":"public_auth_ingress","endpoint":"$nexora_auth_endpoint","method":"POST","at":"$msec","ingressId":"$request_id","status":$status,"upstreamStatus":"$upstream_status","requestSeconds":"$request_time","upstreamSeconds":"$upstream_response_time","protocol":"$server_protocol","tls":"$https"}';
  access_log /dev/stdout nexora_auth_trace if=$nexora_auth_trace;
  # END disposable auth diagnostics`,
  );
}

/** Read-only Linux host observations; interface/address/route contents never escape. */
export function startPublicNetworkObserver({
  platform = process.platform,
  spawnProcess = spawn,
  terminate = terminateChildProcess,
  now = Date.now,
  maxEvents = 32,
} = {}) {
  const capacity = maxEvents === 200 ? 200 : 32;
  const started = now();
  let status = "STARTING",
    reason = null,
    child,
    stopping = false,
    stopped;
  let buffer = "",
    discarding = false,
    dropped = 0;
  const counts = { LINK: 0, ADDR: 0, ROUTE: 0 },
    events = [];
  const unavailable = (category) => {
    status = "UNAVAILABLE";
    reason = category;
  };
  const line = (text) => {
    if (stopping || status !== "OBSERVING") return;
    const category = text.match(/^\[(LINK|ADDR|ROUTE)\]/)?.[1];
    if (!category) return;
    counts[category] = Math.min(10000, counts[category] + 1);
    if (events.length === capacity) {
      events.shift();
      dropped = Math.min(10000, dropped + 1);
    }
    {
      const time = now();
      events.push({
        category,
        interfaceGroup: publicInterfaceGroup(text),
        atUTC: new Date(time).toISOString(),
        elapsedMs: Math.min(600000, Math.max(0, time - started)),
      });
    }
  };
  if (platform !== "linux") unavailable("UNSUPPORTED_PLATFORM");
  else {
    try {
      child = spawnProcess(
        "ip",
        ["-o", "monitor", "label", "link", "address", "route"],
        {
          stdio: ["ignore", "pipe", "ignore"],
          env: { PATH: process.env.PATH, LC_ALL: "C" },
        },
      );
      child.once("spawn", () => {
        if (!stopping && status === "STARTING") status = "OBSERVING";
      });
      child.on("error", () => {
        if (!stopping) unavailable("SPAWN_FAILED");
      });
      child.once("exit", () => {
        if (!stopping) unavailable("EXITED");
      });
      child.stdout.on("data", (chunk) => {
        if (stopping) return;
        for (const character of chunk.toString("utf8")) {
          if (character === "\n") {
            if (!discarding) line(buffer);
            buffer = "";
            discarding = false;
          } else if (!discarding) {
            if (buffer.length < 4096) buffer += character;
            else {
              buffer = "";
              discarding = true;
              dropped = Math.min(10000, dropped + 1);
            }
          }
        }
      });
    } catch {
      unavailable("SPAWN_FAILED");
    }
  }
  return {
    snapshot: () => ({
      status,
      reason,
      startedUTC: new Date(started).toISOString(),
      counts: { ...counts },
      events: events.map((e) => ({ ...e })),
      dropped,
    }),
    stop() {
      if (!stopped)
        stopped = (async () => {
          stopping = true;
          buffer = "";
          try {
            if (child)
              await terminate(child, {
                gracefulTimeoutMs: 500,
                forceTimeoutMs: 500,
              });
            if (status !== "UNAVAILABLE") status = "STOPPED";
          } catch {
            unavailable("STOP_FAILED");
          }
          child?.stdout?.destroy();
        })();
      return stopped;
    },
  };
}

/** Co-occurrence only: a host event does not identify an affected interface/cause. */
export function correlatePublicNetworkEvents(requests, events) {
  return requests.map((row) => {
    const start = Date.parse(row.startedUTC),
      end = start + row.elapsedMs;
    const counts = { LINK: 0, ADDR: 0, ROUTE: 0 };
    for (const event of events.slice(0, 32)) {
      const time = Date.parse(event.atUTC);
      if (Object.hasOwn(counts, event.category) && time >= start && time <= end)
        counts[event.category]++;
    }
    return {
      endpoint: ["LOGIN", "OPERATOR_CREATE", "OPERATOR_SETUP_LINK"].includes(
        row.endpoint,
      )
        ? row.endpoint
        : "OTHER",
      ordinal: row.ordinal,
      counts,
    };
  });
}

/** One diagnostic GET, strict TLS delegated to the existing caller; no auth retry. */
export async function probePublicHttpsReadiness(
  request,
  { now = Date.now, timeoutMs = 3000 } = {},
) {
  const started = now(),
    controller = new globalThis.AbortController();
  const duration =
    Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 3000
      ? timeoutMs
      : 3000;
  let timer;
  const result = {
    probeAttempted: true,
    probeSucceeded: false,
    httpStatus: null,
    elapsedMs: 0,
    safeErrorCategory: null,
  };
  try {
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          Object.assign(Error("Diagnostic timeout"), { name: "TimeoutError" }),
        );
      }, duration);
    });
    const response = await Promise.race([
      Promise.resolve().then(() =>
        request("/api/health/ready", {
          signal: controller.signal,
          timeoutMs: duration,
        }),
      ),
      timeout,
    ]);
    if (
      Number.isInteger(response?.status) &&
      response.status >= 100 &&
      response.status <= 599
    )
      result.httpStatus = response.status;
    result.probeSucceeded = result.httpStatus === 200;
    if (!result.probeSucceeded) result.safeErrorCategory = "HTTP_STATUS";
  } catch (error) {
    const code = error?.code;
    if (["AbortError", "TimeoutError"].includes(error?.name))
      result.safeErrorCategory = "REQUEST_TIMEOUT";
    else result.safeErrorCategory = probeErrors.get(code) ?? "OTHER";
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
  result.elapsedMs = Math.min(60000, Math.max(0, Math.round(now() - started)));
  return result;
}
export async function diagnosePublicHttpsFailure(
  error,
  request,
  write = console.error,
  options,
) {
  try {
    write(
      "PUBLIC_HTTPS_HEALTH_DIAGNOSTIC",
      JSON.stringify(await probePublicHttpsReadiness(request, options)),
    );
  } catch {
    /* Never mask the original assertion. */
  }
  return error;
}

/** Test-only browser observation. Return the original response/data or original error. */
export const operatorResponseObserver = `(async (endpoint, operation) => {
  const row = {endpoint: ['OPERATOR_CREATE','OPERATOR_SETUP_LINK'].includes(endpoint) ? endpoint : 'OTHER', responseReceived:false, status:null, jsonParseSucceeded:false, hasUserId:false, hasSetupUrl:false, setupUrlOriginMatches:null};
  try {
    if (!Array.isArray(window.__nexoraOperatorResponseDiagnostics)) window.__nexoraOperatorResponseDiagnostics = [];
    if (window.__nexoraOperatorResponseDiagnostics.length < 4) window.__nexoraOperatorResponseDiagnostics.push(row);
  } catch { /* Observation cannot change the operation. */ }
  const response = await operation();
  row.responseReceived = true;
  row.status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
  const data = await response.json();
  row.jsonParseSucceeded = true;
  try {
    row.hasUserId = typeof data?.user?.id === 'string' && data.user.id.length > 0;
    row.hasSetupUrl = typeof data?.setupUrl === 'string';
    if (row.hasSetupUrl) row.setupUrlOriginMatches = new URL(data.setupUrl).origin === location.origin;
  } catch { /* Invalid shape/origin is still checked by original assertions. */ }
  return {status:response.status, data, observation:row};
})`;

export function sanitizeOperatorResponseDiagnostics(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map((row) => ({
    endpoint: ["OPERATOR_CREATE", "OPERATOR_SETUP_LINK"].includes(row?.endpoint)
      ? row.endpoint
      : "OTHER",
    responseReceived: row?.responseReceived === true,
    status:
      Number.isInteger(row?.status) && row.status >= 100 && row.status <= 599
        ? row.status
        : null,
    jsonParseSucceeded: row?.jsonParseSucceeded === true,
    hasUserId: row?.hasUserId === true,
    hasSetupUrl: row?.hasSetupUrl === true,
    setupUrlOriginMatches:
      typeof row?.setupUrlOriginMatches === "boolean"
        ? row.setupUrlOriginMatches
        : null,
  }));
}

/** Only closed coarse interface groups may escape raw ip monitor lines. */
function publicInterfaceGroup(line) {
  const name =
    line.match(/\bdev\s+([^\s]+)/)?.[1] ??
    line.match(/^\[(?:LINK|ADDR)\]\s*(?:Deleted\s+)?\d+:\s+([^\s:]+)/)?.[1];
  const base = name?.split("@")[0];
  if (base === "lo") return "lo";
  if (base === "docker0") return "docker0";
  if (/^eth[0-9]+$/.test(base)) return "eth";
  if (/^br-/.test(base)) return "bridge";
  if (/^veth/.test(base)) return "veth";
  return "other";
}
const dockerTypes = new Set([
  "container",
  "network",
  "volume",
  "image",
  "daemon",
  "builder",
]);
const dockerActions = new Set([
  "create",
  "start",
  "restart",
  "stop",
  "die",
  "destroy",
  "connect",
  "disconnect",
  "kill",
  "pause",
  "unpause",
  "oom",
  "remove",
  "health_status: healthy",
  "health_status: unhealthy",
  "health_status: starting",
]);
const composeServices = new Set([
  "builder",
  "init",
  "postgres",
  "migrate",
  "db-runtime",
  "sync-worker",
  "api",
  "web",
  "ingress",
  "certbot",
  "acme-bootstrap",
  "dependencies",
  "quality",
]);
/** Read-only, time-bounded Docker events. No IDs, arbitrary labels or raw JSON retained. */
export function startPublicDockerObserver({
  spawnProcess = spawn,
  terminate = terminateChildProcess,
  now = Date.now,
  durationMs = 2700000,
} = {}) {
  const started = now();
  const duration =
    Number.isInteger(durationMs) && durationMs > 0 && durationMs <= 2700000
      ? durationMs
      : 2700000;
  let child,
    status = "STARTING",
    reason = null,
    stopping = false,
    stopped,
    timer,
    buffer = "",
    discarding = false,
    dropped = 0;
  const events = [];
  const unavailable = (value) => {
    status = "UNAVAILABLE";
    reason = value;
  };
  const line = (text) => {
    if (stopping || status !== "OBSERVING") return;
    let event;
    try {
      event = JSON.parse(text);
    } catch {
      return;
    }
    if (!dockerTypes.has(event?.Type)) return;
    const ms = Number.isFinite(event.timeNano)
      ? Math.floor(event.timeNano / 1000000)
      : event.time * 1000;
    if (!Number.isFinite(ms) || ms < 0 || ms > 4102444800000) return;
    const service = event.Actor?.Attributes?.["com.docker.compose.service"];
    if (events.length === 200) {
      events.shift();
      dropped = Math.min(10000, dropped + 1);
    }
    events.push({
      Type: event.Type,
      Action: dockerActions.has(event.Action) ? event.Action : "other",
      service: composeServices.has(service) ? service : "other",
      atUTC: new Date(ms).toISOString(),
    });
  };
  const stop = () => {
    if (!stopped)
      stopped = (async () => {
        stopping = true;
        clearTimeout(timer);
        buffer = "";
        try {
          if (child)
            await terminate(child, {
              gracefulTimeoutMs: 500,
              forceTimeoutMs: 500,
            });
          if (status !== "UNAVAILABLE") status = "STOPPED";
        } catch {
          unavailable("STOP_FAILED");
        }
        child?.stdout?.destroy();
      })();
    return stopped;
  };
  try {
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, LC_ALL: "C" };
    for (const key of [
      "DOCKER_HOST",
      "DOCKER_CONTEXT",
      "DOCKER_CONFIG",
      "DOCKER_TLS_VERIFY",
      "DOCKER_CERT_PATH",
      "XDG_RUNTIME_DIR",
    ])
      if (process.env[key]) env[key] = process.env[key];
    child = spawnProcess(
      "docker",
      [
        "events",
        "--format",
        "{{json .}}",
        "--since",
        new Date(started).toISOString(),
        "--until",
        new Date(started + duration).toISOString(),
      ],
      { stdio: ["ignore", "pipe", "ignore"], env },
    );
    child.once("spawn", () => {
      if (!stopping && status === "STARTING") status = "OBSERVING";
    });
    child.on("error", () => {
      if (!stopping) unavailable("SPAWN_FAILED");
    });
    child.once("exit", () => {
      if (!stopping) unavailable("EXITED");
    });
    child.stdout.on("data", (chunk) => {
      if (stopping) return;
      for (const character of chunk.toString("utf8")) {
        if (character === "\n") {
          if (!discarding) line(buffer);
          buffer = "";
          discarding = false;
        } else if (!discarding) {
          if (buffer.length < 65536) buffer += character;
          else {
            buffer = "";
            discarding = true;
            dropped = Math.min(10000, dropped + 1);
          }
        }
      }
    });
    timer = setTimeout(() => {
      void stop();
    }, duration);
    timer.unref?.();
  } catch {
    unavailable("SPAWN_FAILED");
  }
  return {
    snapshot: () => ({
      status,
      reason,
      startedUTC: new Date(started).toISOString(),
      events: events.map((e) => ({ ...e })),
      dropped,
    }),
    stop,
  };
}

/** Correlation only, with an explicit fallback if no tracked request failed. */
export function publicEnvironmentFailureWindow(
  environment,
  transport,
  failureTime = Date.now(),
) {
  const failed = (transport?.requests ?? []).filter((row) => row.failed).at(-1);
  const script = (transport?.scriptFailures ?? []).at(-1);
  let source = "FAILURE_TIMESTAMP",
    start = failureTime,
    end = failureTime,
    endpoint = null;
  if (failed && Number.isFinite(Date.parse(failed.startedUTC))) {
    source = "FAILED_AUTH_REQUEST";
    start = Date.parse(failed.startedUTC);
    end = start + failed.elapsedMs;
    endpoint = failed.endpoint;
  } else if (script && Number.isFinite(Date.parse(script.failedUTC))) {
    source = "FAILED_SCRIPT";
    start = end = Date.parse(script.failedUTC);
  }
  const project = (kind) => {
    const state = environment?.[kind];
    return {
      status: state?.status ?? "UNAVAILABLE",
      reason: state?.reason ?? null,
      dropped: state?.dropped ?? 0,
      events: (state?.events ?? []).slice(-200).filter((e) => {
        const time = Date.parse(e.atUTC);
        return time >= start - 5000 && time <= end + 5000;
      }),
    };
  };
  return {
    windowSource: source,
    endpoint,
    fromUTC: new Date(start - 5000).toISOString(),
    toUTC: new Date(end + 5000).toISOString(),
    network: project("network"),
    docker: project("docker"),
  };
}

const containerStates = new Set([
  "created",
  "running",
  "paused",
  "restarting",
  "removing",
  "exited",
  "dead",
]);
const containerDuration =
  "(?:Less than a second|About a minute|About an hour|[0-9]{1,8} (?:second|minute|hour|day|week|month|year)s?)";
const containerStatus = new RegExp(
  `^(?:Created|Dead|Removal In Progress|Up ${containerDuration}(?: \\((?:healthy|unhealthy|health: starting|Paused)\\))?|(?:Exited|Restarting) \\(-?[0-9]{1,8}\\) ${containerDuration} ago)$`,
);

/** Project docker ps JSON lines; never retain arbitrary labels or container identities. */
export function projectPublicPreexistingContainers(text) {
  try {
    if (typeof text !== "string") return { status: "UNAVAILABLE" };
    const containers = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      if (containers.length === 100) break;
      if (line.length > 65536) return { status: "UNAVAILABLE" };
      const row = JSON.parse(line);
      if (!row || typeof row !== "object" || Array.isArray(row))
        return { status: "UNAVAILABLE" };
      const labels = new Map();
      if (typeof row.Labels === "string") {
        for (const label of row.Labels.split(",")) {
          const index = label.indexOf("=");
          if (index > 0)
            labels.set(label.slice(0, index), label.slice(index + 1));
        }
      }
      const project = labels.get("com.docker.compose.project");
      const service = labels.get("com.docker.compose.service");
      let safeProject = null;
      if (project !== undefined) {
        safeProject = "other";
        if (
          project === "nexora-ci" ||
          /^nexora-(?:smoke|https)-[0-9]{1,12}$/.test(project)
        )
          safeProject = project;
      }
      let safeService = null;
      if (service !== undefined)
        safeService = composeServices.has(service) ? service : "other";
      containers.push({
        "com.docker.compose.project": safeProject,
        "com.docker.compose.service": safeService,
        State: containerStates.has(row.State) ? row.State : "other",
        Status:
          typeof row.Status === "string" &&
          row.Status.length <= 100 &&
          containerStatus.test(row.Status)
            ? row.Status
            : "other",
      });
    }
    return { status: "OBSERVED", containers };
  } catch {
    return { status: "UNAVAILABLE" };
  }
}

export function capturePublicPreexistingContainers({ run = spawnSync } = {}) {
  try {
    const result = run("docker", ["ps", "-a", "--format", "{{json .}}"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
      maxBuffer: 1048576,
    });
    if (result.status !== 0 || result.error) return { status: "UNAVAILABLE" };
    return projectPublicPreexistingContainers(result.stdout);
  } catch {
    return { status: "UNAVAILABLE" };
  }
}
