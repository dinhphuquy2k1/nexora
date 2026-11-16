import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createPublicAuthRequestDiagnostics,
  publicAuthIngressTemplate,
} from "./public-https-diagnostics.mjs";
const origin = "https://nexora.example.test:8443";
const secret = "injected-private-auth-marker";
const dispatch = (
  requestId,
  url = origin + "/api/auth/login?secret=" + secret,
) => ({
  method: "Network.requestWillBeSent",
  params: {
    requestId,
    request: {
      url,
      method: "POST",
      headers: { Origin: origin, Authorization: secret, Cookie: secret },
      postData: secret,
    },
  },
});
test("login lifecycle distinguishes no headers/network failure from HTTP failure and successful finish", () => {
  let time = 1000;
  const trace = createPublicAuthRequestDiagnostics(origin, () => time);
  trace.observe(dispatch(secret));
  time += 12;
  trace.observe({
    method: "Network.loadingFailed",
    params: {
      requestId: secret,
      errorText: "net::ERR_HTTP2_PROTOCOL_ERROR",
      canceled: false,
    },
  });
  const failed = trace.snapshot();
  assert.equal(failed.requests[0].responseReceived, false);
  assert.equal(
    failed.requests[0].networkError,
    "net::ERR_HTTP2_PROTOCOL_ERROR",
  );
  assert.equal(failed.requests[0].elapsedMs, 12);
  assert.equal(failed.requests[0].finished, false);
  trace.observe(dispatch("http-error"));
  time += 3;
  trace.observe({
    method: "Network.responseReceived",
    params: {
      requestId: "http-error",
      response: {
        status: 503,
        protocol: "h2",
        remoteIPAddress: "127.0.0.1",
        remotePort: 8443,
        headers: {
          "x-request-id": "00000000-0000-4000-8000-000000000001",
          "set-cookie": secret,
        },
      },
    },
  });
  trace.observe({
    method: "Network.loadingFinished",
    params: { requestId: "http-error" },
  });
  const row = trace.snapshot().requests[1];
  assert.equal(row.status, 503);
  assert.equal(row.finished, true);
  assert.equal(row.networkError, null);
  assert.equal(row.peerLoopback, true);
  assert.equal(row.peerPortMatches, true);
  assert.equal(row.apiRequestId, "00000000-0000-4000-8000-000000000001");
  failed.requests[0].networkError = secret;
  assert.equal(
    trace.snapshot().requests[0].networkError,
    "net::ERR_HTTP2_PROTOCOL_ERROR",
  );
  assert.equal(JSON.stringify(trace.snapshot()).includes(secret), false);
});
test("diagnostics bound requests, restrict origin/path and never serialize unknown CDP strings", () => {
  const trace = createPublicAuthRequestDiagnostics(origin, () => 1000);
  trace.observe(
    dispatch("ignored", "https://other.example.test/api/auth/login"),
  );
  trace.observe(dispatch("ignored-path", origin + "/api/auth/mfa/verify"));
  assert.equal(trace.snapshot().requests.length, 0);
  for (let i = 0; i < 30; i++) {
    trace.observe(dispatch(String(i)));
    trace.observe({
      method: "Network.responseReceived",
      params: {
        requestId: String(i),
        response: {
          status: 200,
          protocol: secret,
          remoteIPAddress: secret,
          remotePort: 0,
          url: secret,
          headers: {
            "x-request-id": secret,
            "set-cookie": secret,
            authorization: secret,
          },
        },
      },
    });
    trace.observe({
      method: "Network.loadingFailed",
      params: {
        requestId: String(i),
        errorText: secret,
        blockedReason: secret,
        canceled: true,
      },
    });
  }
  const state = trace.snapshot();
  assert.equal(state.requests.length, 4);
  assert.ok(state.dropped > 0);
  assert.equal(state.requests[0].protocol, "OTHER");
  assert.equal(state.requests[0].apiRequestId, null);
  assert.equal(state.requests[0].peerLoopback, false);
  assert.equal(state.requests[0].networkError, "OTHER");
  assert.equal(state.requests[0].blockedReason, "OTHER");
  assert.equal(state.requests[0].canceled, true);
  assert.equal(JSON.stringify(state).includes(secret), false);
});
test("disposable ingress diagnostics log only fixed POST login metadata and preserve production policy", () => {
  const original = readFileSync(
    new URL("../docker/public/nginx.conf.template", import.meta.url),
    "utf8",
  );
  const configured = publicAuthIngressTemplate(original);
  assert.match(configured, /POST:\/api\/auth\/login/);
  assert.match(configured, /public_auth_ingress/);
  assert.doesNotMatch(
    configured.match(
      /[ ]{2}# BEGIN disposable auth diagnostics[\s\S]*?[ ]{2}# END disposable auth diagnostics/,
    )[0],
    /\$(?:request_body|http_cookie|http_authorization|args|request_uri|http_referer)/,
  );
  assert.equal(
    configured.replace(
      /[ ]{2}# BEGIN disposable auth diagnostics[\s\S]*?[ ]{2}# END disposable auth diagnostics/,
      "  access_log off;",
    ),
    original,
  );
  assert.throws(() => publicAuthIngressTemplate("unexpected"), /template/);
});

test("pending login age advances without CDP replies while terminal durations stay fixed", () => {
  let time = 1000;
  const trace = createPublicAuthRequestDiagnostics(origin, () => time);
  trace.observe(dispatch("pending"));
  time = 1020;
  assert.equal(trace.snapshot().requests[0].elapsedMs, 20);
  trace.observe({
    method: "Network.loadingFailed",
    params: {
      requestId: "pending",
      errorText: "net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS",
      corsErrorStatus: {
        corsError: "InsecurePrivateNetwork",
        failedParameter: secret,
      },
    },
  });
  time = 1100;
  trace.observe({
    method: "Network.responseReceivedExtraInfo",
    params: { requestId: "pending", headers: { authorization: secret } },
  });
  trace.observe({
    method: "Network.loadingFinished",
    params: { requestId: "pending" },
  });
  const row = trace.snapshot().requests[0];
  assert.equal(row.elapsedMs, 20);
  assert.equal(
    row.networkError,
    "net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS",
  );
  assert.equal(row.corsError, "InsecurePrivateNetwork");
  assert.equal(JSON.stringify(row).includes(secret), false);
});

test("same-origin Next script failures retain bounded transport categories without URLs", () => {
  const trace = createPublicAuthRequestDiagnostics(origin);
  for (let i = 0; i < 20; i++) {
    const event = dispatch(
      secret + i,
      origin + "/_next/static/" + secret + i + ".js",
    );
    event.params.type = "Script";
    trace.observe(event);
    trace.observe({
      method: "Network.loadingFailed",
      params: {
        requestId: secret + i,
        errorText: i === 0 ? "net::ERR_FAILED" : secret,
        corsErrorStatus: {
          corsError: "PrivateNetworkAccessPermissionDenied",
          failedParameter: secret,
        },
        blockedReason: secret,
        canceled: false,
      },
    });
  }
  assert.equal(trace.snapshot().scriptFailures.length, 4);
  assert.equal(
    trace.snapshot().scriptFailures[0].networkError,
    "net::ERR_FAILED",
  );
  assert.equal(
    trace.snapshot().scriptFailures[0].corsError,
    "PrivateNetworkAccessPermissionDenied",
  );
  assert.equal(trace.snapshot().scriptFailures[1].networkError, "OTHER");
  assert.equal(JSON.stringify(trace.snapshot()).includes(secret), false);
  const foreign = createPublicAuthRequestDiagnostics(origin);
  const event = dispatch(
    secret,
    "https://foreign.example/_next/static/private.js",
  );
  event.params.type = "Script";
  foreign.observe(event);
  foreign.observe({
    method: "Network.loadingFailed",
    params: { requestId: secret, errorText: "net::ERR_FAILED" },
  });
  assert.deepEqual(foreign.snapshot().scriptFailures, []);
});

test("an absent observed Origin is unknown rather than a mismatch", () => {
  for (const headers of [{ Authorization: secret }, undefined, null]) {
    const trace = createPublicAuthRequestDiagnostics(origin);
    const event = dispatch("absent-origin");
    event.params.request.headers = headers;
    event.params.arbitrary = secret;
    trace.observe(event);
    assert.equal(trace.snapshot().requests[0].originHeaderMatches, null);
    assert.equal(JSON.stringify(trace.snapshot()).includes(secret), false);
  }
});

test("observed string Origins compare exactly with case-insensitive header names", () => {
  for (const key of ["origin", "Origin", "ORIGIN"]) {
    for (const value of [
      origin,
      "https://" + secret + ".invalid",
      origin + "/",
      origin + " ",
      origin.toUpperCase(),
      "",
    ]) {
      const trace = createPublicAuthRequestDiagnostics(origin);
      const event = dispatch("observed-origin");
      event.params.request.headers = {
        [key]: value,
        Authorization: secret,
        Cookie: secret,
      };
      event.params.arbitrary = secret;
      trace.observe(event);
      assert.equal(
        trace.snapshot().requests[0].originHeaderMatches,
        value === origin,
      );
      assert.equal(JSON.stringify(trace.snapshot()).includes(secret), false);
    }
  }
});

test("unusable observed Origin values remain unknown without exposing CDP payloads", () => {
  for (const value of [
    undefined,
    null,
    123,
    false,
    [origin],
    { private: secret },
  ]) {
    const trace = createPublicAuthRequestDiagnostics(origin);
    const event = dispatch("unusable-origin");
    event.params.request.headers.Origin = value;
    event.params.arbitrary = secret;
    trace.observe(event);
    assert.equal(trace.snapshot().requests[0].originHeaderMatches, null);
    assert.equal(JSON.stringify(trace.snapshot()).includes(secret), false);
  }
});
