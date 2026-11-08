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
