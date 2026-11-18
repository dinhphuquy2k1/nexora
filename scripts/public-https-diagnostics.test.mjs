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
test("disposable ingress diagnostics log fixed POST auth/operator metadata and preserve production policy", () => {
  const original = readFileSync(
    new URL("../docker/public/nginx.conf.template", import.meta.url),
    "utf8",
  );
  const configured = publicAuthIngressTemplate(original);
  assert.match(configured, /POST:\/api\/auth\/login/);
  assert.match(configured, /public_auth_ingress/);
  assert.match(configured, /POST:\/api\/admin\/operators/);
  assert.match(configured, /OPERATOR_CREATE/);
  assert.match(configured, /OPERATOR_SETUP_LINK/);
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

// Fault injection for diagnostic-only extensions; no external network/authentication.
import * as diagnostics from "./public-https-diagnostics.mjs";
import { EventEmitter, once } from "node:events";
import { PassThrough } from "node:stream";
import { spawn } from "node:child_process";
import vm from "node:vm";

test("network-change before headers is distinct from HTTP failure and cancellation", () => {
  const trace = createPublicAuthRequestDiagnostics(origin);
  trace.observe(dispatch("network-change"));
  trace.observe({
    method: "Network.loadingFailed",
    params: {
      requestId: "network-change",
      errorText: "net::ERR_NETWORK_CHANGED",
      canceled: false,
    },
  });
  trace.observe(dispatch("cancel"));
  trace.observe({
    method: "Network.loadingFailed",
    params: {
      requestId: "cancel",
      errorText: "net::ERR_ABORTED",
      canceled: true,
    },
  });
  const [changed, canceled] = trace.snapshot().requests;
  assert.equal(changed.responseReceived, false);
  assert.equal(changed.status, null);
  assert.equal(changed.networkError, "net::ERR_NETWORK_CHANGED");
  assert.equal(canceled.canceled, true);
});

test("operator lifecycle uses fixed labels, bounded per-endpoint caps and no route IDs/URLs", () => {
  const trace = createPublicAuthRequestDiagnostics(origin);
  const id = "00000000-0000-4000-8000-000000000001";
  for (const url of [
    origin + "/api/admin/operators",
    origin + "/api/admin/operators/" + id + "/setup-link",
  ]) {
    for (let i = 0; i < 10; i++) {
      const key = url + i + secret;
      trace.observe(dispatch(key, url + "?token=" + secret));
      trace.observe({
        method: "Network.responseReceived",
        params: {
          requestId: key,
          response: {
            status: 201,
            protocol: "h2",
            headers: { authorization: secret, "set-cookie": secret },
            remoteIPAddress: secret,
          },
        },
      });
      trace.observe({
        method: "Network.loadingFinished",
        params: { requestId: key },
      });
    }
  }
  for (let i = 0; i < 8; i++) trace.observe(dispatch("login" + i));
  const state = trace.snapshot();
  assert.equal(state.requests.length, 12);
  for (const endpoint of ["LOGIN", "OPERATOR_CREATE", "OPERATOR_SETUP_LINK"])
    assert.equal(
      state.requests.filter((r) => r.endpoint === endpoint).length,
      4,
    );
  assert.equal(state.requests[0].responseReceived, true);
  assert.equal(state.requests[0].status, 201);
  assert.equal(state.requests[0].finished, true);
  const text = JSON.stringify(state);
  for (const value of [
    secret,
    id,
    "setup-link",
    "https://",
    "Authorization",
    "Cookie",
  ])
    assert.equal(text.includes(value), false);
  const ignored = createPublicAuthRequestDiagnostics(origin);
  ignored.observe(
    dispatch("bad", origin + "/api/admin/operators/" + secret + "/setup-link"),
  );
  const get = dispatch("get", origin + "/api/admin/operators");
  get.params.request.method = "GET";
  ignored.observe(get);
  assert.equal(ignored.snapshot().requests.length, 0);
});

function fakeMonitor() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.exitCode = null;
  child.signalCode = null;
  return child;
}
test("network observer bounds and redacts events, correlates intervals and cleans up once", async () => {
  const child = fakeMonitor();
  let time = 1000,
    stopped = 0;
  const monitor = diagnostics.startPublicNetworkObserver({
    platform: "linux",
    now: () => time,
    spawnProcess: (command, args, options) => {
      assert.equal(command, "ip");
      assert.deepEqual(args, [
        "-o",
        "monitor",
        "label",
        "link",
        "address",
        "route",
      ]);
      assert.deepEqual(options.stdio, ["ignore", "pipe", "ignore"]);
      return child;
    },
    terminate: async (c) => {
      assert.equal(c, child);
      stopped++;
      child.signalCode = "SIGTERM";
      child.emit("exit", null, "SIGTERM");
    },
  });
  child.emit("spawn");
  time = 1010;
  child.stdout.write(
    ("[LINK] " + secret + " 01:02:03:04:05:06 192.0.2.1\n").repeat(40),
  );
  child.stdout.write("[ADDR] " + secret + "\n[ROUTE] " + secret + "\n");
  child.stdout.write("[LINK]" + secret.repeat(1000) + "\n");
  const state = monitor.snapshot();
  assert.equal(state.status, "OBSERVING");
  assert.equal(state.events.length, 32);
  assert.deepEqual(state.counts, { LINK: 40, ADDR: 1, ROUTE: 1 });
  assert.ok(state.dropped > 0);
  assert.equal(JSON.stringify(state).includes(secret), false);
  const requests = [
    {
      endpoint: "LOGIN",
      ordinal: 1,
      startedUTC: new Date(1005).toISOString(),
      elapsedMs: 10,
    },
    {
      endpoint: "OPERATOR_CREATE",
      ordinal: 2,
      startedUTC: new Date(2000).toISOString(),
      elapsedMs: 10,
    },
  ];
  const correlated = diagnostics.correlatePublicNetworkEvents(
    requests,
    state.events,
  );
  assert.equal(correlated[0].counts.LINK, 32);
  assert.equal(correlated[1].counts.LINK, 0);
  await monitor.stop();
  await monitor.stop();
  assert.equal(stopped, 1);
  assert.equal(monitor.snapshot().status, "STOPPED");
});
test("network observer reports unavailable platforms/startup/early exit without raw errors", async () => {
  const unavailable = diagnostics.startPublicNetworkObserver({
    platform: "win32",
    spawnProcess: () => {
      throw Error("must not spawn");
    },
  });
  assert.equal(unavailable.snapshot().status, "UNAVAILABLE");
  await unavailable.stop();
  const failed = diagnostics.startPublicNetworkObserver({
    platform: "linux",
    spawnProcess: () => {
      throw Error(secret);
    },
  });
  assert.equal(failed.snapshot().status, "UNAVAILABLE");
  assert.equal(JSON.stringify(failed.snapshot()).includes(secret), false);
  await failed.stop();
  const child = fakeMonitor();
  const exited = diagnostics.startPublicNetworkObserver({
    platform: "linux",
    spawnProcess: () => child,
    terminate: async () => {},
  });
  child.exitCode = 1;
  child.emit("exit", 1, null);
  assert.equal(exited.snapshot().status, "UNAVAILABLE");
  await exited.stop();
});
test("network observer terminates a real owned child and retains only sanitized output", async (t) => {
  let child;
  const monitor = diagnostics.startPublicNetworkObserver({
    platform: "linux",
    spawnProcess: (_command, _args, options) => {
      child = spawn(
        process.execPath,
        [
          "-e",
          "process.stdout.write('[LINK] private-owned-test-line\\n');setInterval(()=>{},1000)",
        ],
        options,
      );
      return child;
    },
  });
  t.after(() => monitor.stop());
  await once(child.stdout, "data", { signal: AbortSignal.timeout(3000) });
  assert.equal(monitor.snapshot().events[0].category, "LINK");
  await monitor.stop();
  assert.ok(child.exitCode !== null || child.signalCode !== null);
  assert.equal(
    JSON.stringify(monitor.snapshot()).includes("private-owned-test-line"),
    false,
  );
});
test("health probe is one bounded GET and never masks the original failure or leaks bodies/errors", async () => {
  let calls = 0,
    time = 1000;
  const result = await diagnostics.probePublicHttpsReadiness(
    async (path, options) => {
      calls++;
      assert.equal(path, "/api/health/ready");
      assert.equal(options.timeoutMs, 3000);
      assert.ok(options.signal);
      time += 7;
      return { status: 200, text: secret, headers: { cookie: secret } };
    },
    { now: () => time },
  );
  assert.deepEqual(result, {
    probeAttempted: true,
    probeSucceeded: true,
    httpStatus: 200,
    elapsedMs: 7,
    safeErrorCategory: null,
  });
  assert.equal(calls, 1);
  const original = Error(secret);
  const writes = [];
  const preserved = await diagnostics.diagnosePublicHttpsFailure(
    original,
    async () => {
      throw Object.assign(Error(secret), { code: "ECONNRESET" });
    },
    (...args) => writes.push(args.join(" ")),
  );
  assert.equal(preserved, original);
  assert.ok(writes[0].includes("CONNECTION_RESET"));
  assert.equal(writes.join("").includes(secret), false);
  const unknown = await diagnostics.probePublicHttpsReadiness(async () => {
    throw Object.assign(Error(secret), { code: secret });
  });
  assert.equal(unknown.safeErrorCategory, "OTHER");
  const http = await diagnostics.probePublicHttpsReadiness(async () => ({
    status: 503,
    text: secret,
  }));
  assert.equal(http.safeErrorCategory, "HTTP_STATUS");
  assert.equal(http.httpStatus, 503);
  const timeout = await diagnostics.probePublicHttpsReadiness(
    () => new Promise(() => {}),
    { timeoutMs: 5 },
  );
  assert.equal(timeout.safeErrorCategory, "REQUEST_TIMEOUT");
  assert.equal(
    await diagnostics.diagnosePublicHttpsFailure(
      original,
      async () => ({ status: 200 }),
      () => {
        throw Error(secret);
      },
    ),
    original,
  );
});
test("operator response observation separates headers/JSON/shape and preserves original data/errors", async () => {
  const window = {};
  const observe = vm.runInNewContext(diagnostics.operatorResponseObserver, {
    window,
    location: { origin },
    URL,
  });
  const data = {
    user: { id: secret },
    setupUrl: origin + "/setup#token=" + secret,
    password: secret,
    mfa: secret,
  };
  const result = await observe("OPERATOR_CREATE", async () => ({
    status: 201,
    json: async () => data,
  }));
  assert.equal(result.data, data);
  assert.equal(result.status, 201);
  assert.deepEqual(
    JSON.parse(JSON.stringify(window.__nexoraOperatorResponseDiagnostics[0])),
    {
      endpoint: "OPERATOR_CREATE",
      responseReceived: true,
      status: 201,
      jsonParseSucceeded: true,
      hasUserId: true,
      hasSetupUrl: true,
      setupUrlOriginMatches: true,
    },
  );
  const original = Error(secret);
  await assert.rejects(
    observe("OPERATOR_SETUP_LINK", async () => ({
      status: 502,
      json: async () => {
        throw original;
      },
    })),
    (e) => e === original,
  );
  await assert.rejects(
    observe("OPERATOR_CREATE", async () => {
      throw original;
    }),
    (e) => e === original,
  );
  for (let i = 0; i < 10; i++)
    await observe(secret, async () => ({
      status: 200,
      json: async () => ({ setupUrl: secret }),
    }));
  assert.equal(window.__nexoraOperatorResponseDiagnostics.length, 4);
  assert.equal(
    window.__nexoraOperatorResponseDiagnostics[1].jsonParseSucceeded,
    false,
  );
  assert.equal(
    window.__nexoraOperatorResponseDiagnostics[2].responseReceived,
    false,
  );
  assert.equal(window.__nexoraOperatorResponseDiagnostics[3].endpoint, "OTHER");
  assert.equal(
    JSON.stringify(window.__nexoraOperatorResponseDiagnostics).includes(secret),
    false,
  );
});

test("diagnostic projection rejects prototype names and arbitrary operator payload fields", async () => {
  for (const code of ["__proto__", "constructor", "toString"])
    assert.equal(
      (
        await diagnostics.probePublicHttpsReadiness(async () => {
          throw Object.assign(Error(secret), { code });
        })
      ).safeErrorCategory,
      "OTHER",
    );
  const rows = diagnostics.sanitizeOperatorResponseDiagnostics([
    {
      endpoint: secret,
      responseReceived: secret,
      status: secret,
      jsonParseSucceeded: secret,
      hasUserId: secret,
      hasSetupUrl: secret,
      setupUrlOriginMatches: secret,
      setupUrl: secret,
      password: secret,
    },
  ]);
  assert.deepEqual(rows, [
    {
      endpoint: "OTHER",
      responseReceived: false,
      status: null,
      jsonParseSucceeded: false,
      hasUserId: false,
      hasSetupUrl: false,
      setupUrlOriginMatches: null,
    },
  ]);
  assert.equal(JSON.stringify(rows).includes(secret), false);
});

test("successful login lifecycle retains only safe response metadata", () => {
  const trace = createPublicAuthRequestDiagnostics(origin);
  trace.observe(dispatch("success"));
  trace.observe({
    method: "Network.responseReceived",
    params: {
      requestId: "success",
      response: {
        status: 200,
        protocol: "h2",
        headers: {
          "x-request-id": "00000000-0000-4000-8000-000000000001",
          "set-cookie": secret,
        },
        remoteIPAddress: "127.0.0.1",
        remotePort: 8443,
      },
    },
  });
  trace.observe({
    method: "Network.loadingFinished",
    params: { requestId: "success" },
  });
  const row = trace.snapshot().requests[0];
  assert.equal(row.endpoint, "LOGIN");
  assert.equal(row.status, 200);
  assert.equal(row.finished, true);
  assert.equal(row.failed, false);
  assert.equal(JSON.stringify(row).includes(secret), false);
});

test("operator observations survive full-document navigation without retaining response payload", async () => {
  const window = {};
  const observe = vm.runInNewContext(diagnostics.operatorResponseObserver, {
    window,
    location: { origin },
    URL,
  });
  const result = await observe("OPERATOR_CREATE", async () => ({
    status: 201,
    json: async () => ({
      user: { id: secret },
      setupUrl: origin + "/setup#token=" + secret,
    }),
  }));
  const saved = diagnostics.sanitizeOperatorResponseDiagnostics([
    result.observation,
  ]);
  delete window.__nexoraOperatorResponseDiagnostics;
  assert.equal(saved[0].status, 201);
  assert.equal(saved[0].setupUrlOriginMatches, true);
  assert.equal(JSON.stringify(saved).includes(secret), false);
});
