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
/** Login-only diagnostics: opaque CDP IDs stay private; never retain a raw event. */
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
          url.origin !== expected.origin ||
          url.pathname !== "/api/auth/login"
        )
          return;
        if (requests.has(params.requestId)) return;
        if (requests.size === 4) {
          dropped = Math.min(64, dropped + 1);
          return;
        }
        const started = now();
        const origin = Object.entries(params.request.headers ?? {}).find(
          ([key]) => key.toLowerCase() === "origin",
        )?.[1];
        requests.set(params.requestId, {
          started,
          row: {
            ordinal: requests.size + 1,
            origin: expected.origin,
            url: expected.origin + "/api/auth/login",
            method: ["POST", "GET", "OPTIONS"].includes(params.request.method)
              ? params.request.method
              : "OTHER",
            originHeaderMatches: origin === expected.origin,
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
  map "$request_method:$uri" $nexora_auth_trace {
    default 0;
    "POST:/api/auth/login" 1;
  }
  log_format nexora_auth_trace escape=json '{"event":"public_auth_ingress","endpoint":"LOGIN","method":"POST","at":"$msec","ingressId":"$request_id","status":$status,"upstreamStatus":"$upstream_status","requestSeconds":"$request_time","upstreamSeconds":"$upstream_response_time","protocol":"$server_protocol","tls":"$https"}';
  access_log /dev/stdout nexora_auth_trace if=$nexora_auth_trace;
  # END disposable auth diagnostics`,
  );
}
