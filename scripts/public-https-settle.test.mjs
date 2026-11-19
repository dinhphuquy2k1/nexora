import test from "node:test";
import assert from "node:assert/strict";
import {
  waitForNetworkSettle,
  createBrowserStartWindow,
} from "./public-https-settle.mjs";
function fixture(eventAt = -1, unavailable = false) {
  let time = 0;
  return {
    now: () => time,
    sleep: async (ms) => {
      time += ms;
    },
    snapshot: async () => ({
      capturedUTC: new Date(time).toISOString(),
      network: {
        status: unavailable ? "UNAVAILABLE" : "OBSERVING",
        counts: { ADDR: time >= eventAt && eventAt >= 0 ? 1 : 0, ROUTE: 0 },
        groupCounts: {
          veth: { ADDR: time >= eventAt && eventAt >= 0 ? 1 : 0, ROUTE: 0 },
        },
      },
      docker: { events: [] },
    }),
  };
}
test("quiet gate waits5s and resets on new activity", async () => {
  assert.equal((await waitForNetworkSettle(fixture())).waitedMs, 5000);
  const r = await waitForNetworkSettle(fixture(2000));
  assert.equal(r.waitedMs, 7000);
  assert.equal(r.events.veth.ADDR, 1);
});
test("unavailable waits5s and reports fallback", async () => {
  const r = await waitForNetworkSettle(fixture(-1, true));
  assert.equal(r.waitedMs, 5000);
  assert.equal(r.status, "UNAVAILABLE");
});
test("continuous activity times out with fixed diagnostic and counts", async () => {
  let t = 0;
  const lines = [];
  await assert.rejects(
    waitForNetworkSettle({
      now: () => t,
      sleep: async (ms) => {
        t += ms;
      },
      log: (s) => lines.push(s),
      snapshot: async () => ({
        network: {
          status: "OBSERVING",
          counts: { ADDR: t, ROUTE: 0 },
          groupCounts: { eth: { ADDR: t, ROUTE: 0 } },
        },
        docker: { events: [] },
      }),
    }),
    /PUBLIC_HTTPS_NETWORK_SETTLE_TIMEOUT/,
  );
  assert.equal(
    JSON.parse(lines[0].split(" ").slice(1).join(" ")).waitedMs,
    30000,
  );
  assert.equal(
    JSON.parse(lines[0].split(" ").slice(1).join(" ")).ingressStartUTC,
    null,
  );
});
test("window bounds, privacy, outcomes and time boundary", () => {
  let t = 1000;
  const w = createBrowserStartWindow({ launchedAt: t, now: () => t });
  for (let i = 0; i < 205; i++)
    w.observe({
      method: "Network.requestWillBeSent",
      params: {
        requestId: String(i),
        type: "Script",
        request: {
          url: "https://secret.test/token",
          headers: { Cookie: "secret" },
        },
      },
    });
  w.observe({
    method: "Network.loadingFailed",
    params: {
      requestId: "0",
      errorText: "net::ERR_NETWORK_CHANGED",
      secret: "token",
    },
  });
  w.observe({ method: "Network.loadingFinished", params: { requestId: "1" } });
  w.observe({
    method: "Network.loadingFailed",
    params: { requestId: "2", errorText: "secret" },
  });
  for (let i = 0; i < 70; i++)
    w.network({
      category: "ADDR",
      interfaceGroup: "veth",
      atUTC: new Date(t).toISOString(),
      address: "secret",
    });
  t = 11001;
  w.observe({
    method: "Network.requestWillBeSent",
    params: { requestId: "late", type: "Script" },
  });
  const r = w.snapshot();
  assert.equal(r.requests.length, 200);
  assert.equal(r.requestsDropped, 5);
  assert.equal(r.events.length, 64);
  assert.equal(r.eventsDropped, 6);
  assert.equal(r.requests[0].result, "net::ERR_NETWORK_CHANGED");
  assert.equal(r.requests[1].result, "ok");
  assert.equal(r.requests[2].result, "OTHER_ERROR");
  assert.equal(r.complete, true);
  assert.ok(!JSON.stringify(r).includes("secret"));
  assert.ok(!JSON.stringify(r).includes("requestId"));
});

test("late observer loss cannot exceed30s deadline", async () => {
  let time = 0;
  const lines = [];
  await assert.rejects(
    waitForNetworkSettle({
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
      log: (s) => lines.push(s),
      snapshot: async () => ({
        network: {
          status: time >= 28000 ? "UNAVAILABLE" : "OBSERVING",
          groupCounts: { eth: { ADDR: time, ROUTE: 0 } },
        },
      }),
    }),
    /PUBLIC_HTTPS_NETWORK_SETTLE_TIMEOUT/,
  );
  assert.equal(time, 30000);
  assert.equal(lines.length, 1);
});

test("window excludes later terminals and preserves partial pending state", () => {
  let time = 0;
  const w = createBrowserStartWindow({ launchedAt: 0, now: () => time });
  w.enabled();
  w.observe({
    method: "Network.requestWillBeSent",
    params: { requestId: "x", type: "unknown-private" },
  });
  assert.equal(w.snapshot().complete, false);
  assert.equal(w.snapshot().requests[0].resourceType, "Other");
  time = 10001;
  w.observe({ method: "Network.loadingFinished", params: { requestId: "x" } });
  assert.equal(w.snapshot().requests[0].result, "pending");
  assert.equal(w.snapshot().requests[0].endedUTC, null);
});
