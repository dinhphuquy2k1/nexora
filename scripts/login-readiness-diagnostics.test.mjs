import test from "node:test";
import assert from "node:assert/strict";
import { createLoginReadinessDiagnostics } from "./login-readiness-diagnostics.mjs";

test("pre-auth diagnostics retain only closed counts, never CDP payloads or exception messages", () => {
  const privateText = "private-password-cookie-token-username";
  const d = createLoginReadinessDiagnostics();
  d.observe({
    method: "Network.responseReceived",
    params: {
      type: "Script",
      response: {
        status: 200,
        url: privateText,
        headers: { authorization: privateText },
      },
    },
  });
  d.observe({
    method: "Network.responseReceived",
    params: { type: "Script", response: { status: 404, url: privateText } },
  });
  d.observe({
    method: "Network.loadingFailed",
    params: { type: "Script", errorText: "net::ERR_CERT_AUTHORITY_INVALID" },
  });
  d.observe({
    method: "Network.loadingFailed",
    params: { type: "Script", errorText: privateText },
  });
  d.observe({
    method: "Runtime.exceptionThrown",
    params: {
      exceptionDetails: {
        text: privateText,
        exception: { description: privateText },
      },
    },
  });
  d.observe({
    method: "Runtime.executionContextsCleared",
    params: { privateText },
  });
  d.observe({ method: "Page.domContentEventFired", params: { timestamp: 1 } });
  d.observe({ method: "Page.loadEventFired", params: { timestamp: 2 } });
  d.evaluationFailed();
  d.protocolFailed();
  assert.deepEqual(d.snapshot(), {
    scriptResponses: 2,
    scriptHttpErrors: 1,
    scriptLoadFailures: 2,
    certificateFailures: 1,
    documentLoadFailures: 0,
    runtimeExceptions: 1,
    contextsCleared: 1,
    documentNavigations: 0,
    domContentEvents: 1,
    loadEvents: 1,
    evaluationFailures: 1,
    protocolFailures: 1,
    scriptFailureReasons: {
      ABORTED: 0,
      BLOCKED: 0,
      CERTIFICATE: 1,
      CONNECTION_CLOSED: 0,
      CONNECTION_RESET: 0,
      EMPTY_RESPONSE: 0,
      HTTP2_PROTOCOL_ERROR: 0,
      TIMED_OUT: 0,
      OTHER: 1,
    },
    scriptFailuresCanceled: 0,
  });
  assert.equal(JSON.stringify(d.snapshot()).includes(privateText), false);
  d.stop();
  d.observe({ method: "Runtime.exceptionThrown" });
  d.evaluationFailed();
  d.protocolFailed();
  assert.equal(d.snapshot().runtimeExceptions, 1);
  assert.equal(d.snapshot().evaluationFailures, 1);
});

test("irrelevant resources are excluded and observations remain bounded", () => {
  const d = createLoginReadinessDiagnostics();
  d.observe({
    method: "Network.loadingFailed",
    params: { type: "Fetch", errorText: "private" },
  });
  d.observe({
    method: "Network.responseReceived",
    params: { type: "Script", response: { status: 200.5 } },
  });
  for (let i = 0; i < 10010; i++)
    d.observe({
      method: "Page.frameNavigated",
      params: { frame: { url: "private" } },
    });
  assert.equal(d.snapshot().documentNavigations, 10000);
  assert.equal(d.snapshot().scriptResponses, 0);
  assert.equal(d.snapshot().scriptLoadFailures, 0);
});

test("Login observer excludes full-document Setup and starts fresh on explicit Login installation", async () => {
  const { runInNewContext } = await import("node:vm");
  const { loginReadinessObserver } = await import(
    "./login-readiness-diagnostics.mjs"
  );
  let registrations = 0,
    removals = 0,
    disconnected = 0,
    mutation;
  const context = {
    location: { pathname: "/setup" },
    window: {},
    document: {
      querySelector: () => ({ type: "password" }),
      addEventListener: () => registrations++,
      removeEventListener: () => removals++,
    },
    MutationObserver: class {
      constructor(callback) {
        mutation = callback;
      }
      observe() {}
      disconnect() {
        disconnected++;
      }
    },
  };
  runInNewContext(loginReadinessObserver, context);
  assert.equal(registrations, 0);
  assert.equal(context.window.__nexoraLoginReadiness, undefined);
  context.location.pathname = "/login";
  assert.equal(
    registrations,
    0,
    "client navigation cannot start observation implicitly",
  );
  runInNewContext(loginReadinessObserver, context);
  const probe = context.window.__nexoraLoginReadiness;
  assert.equal(registrations, 1);
  assert.equal(probe.snapshot().typeTransitions, 1);
  probe.stop();
  context.document.querySelector = () => ({ type: "text" });
  mutation();
  assert.equal(probe.snapshot().typeTransitions, 1);
  assert.equal(disconnected, 1);
  assert.equal(removals, 1);
});

test("script load failures map to closed reasons without payloads", () => {
  const d = createLoginReadinessDiagnostics();
  const cases = [
    ["net::ERR_ABORTED", "ABORTED"],
    ["net::ERR_CONNECTION_RESET", "CONNECTION_RESET"],
    ["net::ERR_CONNECTION_CLOSED", "CONNECTION_CLOSED"],
    ["net::ERR_EMPTY_RESPONSE", "EMPTY_RESPONSE"],
    ["net::ERR_HTTP2_PROTOCOL_ERROR", "HTTP2_PROTOCOL_ERROR"],
    ["net::ERR_TIMED_OUT", "TIMED_OUT"],
    ["net::ERR_CERT_DATE_INVALID", "CERTIFICATE"],
    ["private-url-token", "OTHER"],
  ];
  for (const [errorText] of cases)
    d.observe({
      method: "Network.loadingFailed",
      params: { type: "Script", errorText },
    });
  d.observe({
    method: "Network.loadingFailed",
    params: {
      type: "Script",
      errorText: "net::ERR_BLOCKED_BY_RESPONSE",
      blockedReason: "private-reason",
    },
  });
  d.observe({
    method: "Network.loadingFailed",
    params: { type: "Script", errorText: "net::ERR_ABORTED", canceled: true },
  });
  d.observe({
    method: "Network.loadingFailed",
    params: { type: "Fetch", errorText: "net::ERR_ABORTED" },
  });
  const s = d.snapshot();
  for (const [, reason] of cases)
    assert.ok(s.scriptFailureReasons[reason] >= 1, reason);
  assert.equal(s.scriptFailureReasons.ABORTED, 2);
  assert.equal(s.scriptFailureReasons.BLOCKED, 1);
  assert.equal(s.scriptFailuresCanceled, 1);
  assert.equal(s.scriptLoadFailures, 10);
  assert.equal(JSON.stringify(s).includes("private"), false);
});
