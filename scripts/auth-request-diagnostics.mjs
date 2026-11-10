import { performance } from "node:perf_hooks";
import { loginOutcome } from "../apps/web/lib/auth/login-outcome.ts";

const operations = new Map([
  ["/api/auth/login", "LOGIN"],
  ["/api/auth/mfa/verify", "MFA_VERIFY"],
  ["/api/auth/setup-password", "SETUP_PASSWORD"],
]);
const transportCodes = new Set([
  "net::ERR_FAILED",
  "net::ERR_ABORTED",
  "net::ERR_TIMED_OUT",
  "net::ERR_CONNECTION_RESET",
  "net::ERR_CONNECTION_CLOSED",
  "net::ERR_CONNECTION_REFUSED",
  "net::ERR_NAME_NOT_RESOLVED",
  "net::ERR_NETWORK_CHANGED",
  "net::ERR_INTERNET_DISCONNECTED",
  "net::ERR_ADDRESS_UNREACHABLE",
  "net::ERR_EMPTY_RESPONSE",
  "net::ERR_HTTP2_PROTOCOL_ERROR",
  "net::ERR_INVALID_RESPONSE",
  "net::ERR_CERT_AUTHORITY_INVALID",
  "net::ERR_CERT_COMMON_NAME_INVALID",
  "net::ERR_CERT_DATE_INVALID",
  "net::ERR_SSL_PROTOCOL_ERROR",
  "net::ERR_BLOCKED_BY_CLIENT",
  "net::ERR_BLOCKED_BY_RESPONSE",
  "net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS",
]);
const blockedReasons = new Set([
  "csp",
  "mixed-content",
  "origin",
  "inspector",
  "other",
  "subresource-filter",
  "content-type",
  "collapsed-by-client",
  "corp-not-same-origin",
  "corp-not-same-site",
]);
const errorCodes = new Set([
  "MFA_ENROLLMENT_REQUIRED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "AUTHENTICATION_FAILED",
  "TOO_MANY_REQUESTS",
  "INTERNAL_SERVER_ERROR",
  "SERVICE_UNAVAILABLE",
]);

/** Test-only bounded observations. Never retain raw URLs, headers, bodies or exceptions. */
export function createAuthRequestDiagnostics(
  origin,
  now = () => performance.now(),
) {
  const records = new Map();
  let runtimeExceptions = 0;
  const elapsed = (start) =>
    Math.max(0, Math.min(3600000, Math.round(now() - start)));
  return {
    observe({ method, params = {} }) {
      if (method === "Runtime.exceptionThrown")
        runtimeExceptions = Math.min(10000, runtimeExceptions + 1);
      if (method === "Network.requestWillBeSent") {
        if (records.has(params.requestId) || records.size >= 16) return;
        const request = params.request;
        if (request?.method !== "POST") return;
        let url;
        try {
          url = new URL(request.url);
        } catch {
          return;
        }
        const operation = url.origin === origin && operations.get(url.pathname);
        if (operation)
          records.set(params.requestId, {
            start: now(),
            value: { operation, state: "PENDING" },
          });
        return;
      }
      const record = records.get(params.requestId);
      if (!record) return;
      if (method === "Network.responseReceived") {
        const status = params.response?.status;
        if (Number.isInteger(status) && status >= 100 && status <= 599) {
          record.value.status = status;
          record.value.state = "HTTP_RESPONSE";
        }
      }
      if (method === "Network.loadingFailed") {
        record.value.state = "FAILED";
        record.value.transportCode = transportCodes.has(params.errorText)
          ? params.errorText
          : "OTHER";
        if (params.blockedReason)
          record.value.blockedReason = blockedReasons.has(params.blockedReason)
            ? params.blockedReason
            : "OTHER";
        if (params.corsErrorStatus) record.value.corsFailure = true;
        record.value.elapsedMs = elapsed(record.start);
      }
      if (method === "Network.loadingFinished") {
        record.value.state = "FINISHED";
        record.value.elapsedMs = elapsed(record.start);
        if (record.value.status !== undefined) {
          record.value.outcome = "BODY_PENDING";
          return params.requestId;
        }
      }
    },
    body(requestId, text, base64Encoded) {
      const record = records.get(requestId)?.value;
      if (!record || record.state !== "FINISHED") return;
      if (base64Encoded || typeof text !== "string" || text.length > 16384) {
        record.outcome = "BODY_UNAVAILABLE";
        return;
      }
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        record.outcome = "UNREADABLE_JSON";
        return;
      }
      if (record.status >= 200 && record.status < 300)
        record.outcome =
          record.operation === "SETUP_PASSWORD"
            ? "JSON_OBSERVED"
            : loginOutcome(payload);
      else {
        delete record.outcome;
        record.errorCode = errorCodes.has(payload?.code)
          ? payload.code
          : "OTHER";
      }
    },
    snapshot() {
      return {
        requests: [...records.values()].map(({ start, value }) => ({
          ...value,
          elapsedMs: value.elapsedMs ?? elapsed(start),
        })),
        runtimeExceptions,
      };
    },
  };
}
