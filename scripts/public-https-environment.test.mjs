import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import * as diagnostics from "./public-https-diagnostics.mjs";
const fake = () => {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  return child;
};

test("network observer projects all interface groups from labeled ip monitor formats", async () => {
  const child = fake();
  const observer = diagnostics.startPublicNetworkObserver({
    platform: "linux",
    spawnProcess: () => child,
    terminate: async () => {},
  });
  child.emit("spawn");
  const cases = [
    ["[LINK]1: lo: <LOOPBACK> mtu 65536", "lo"],
    ["[ADDR]2: eth0    inet 192.0.2.1/24 scope global eth0", "eth"],
    ["[ADDR]Deleted 3: docker0 inet6 2001:db8::1/64 scope link", "docker0"],
    ["[ROUTE] 192.0.2.0/24 dev br-private scope link", "bridge"],
    ["[LINK]Deleted 4: veth-private@if8: <BROADCAST>", "veth"],
    ["[ROUTE] Deleted default via 192.0.2.1 dev tun-private", "other"],
    ["[ROUTE] default via 192.0.2.1", "other"],
  ];
  for (const [line] of cases) child.stdout.write(line + "\n");
  assert.deepEqual(
    observer.snapshot().events.map((e) => e.interfaceGroup),
    cases.map((c) => c[1]),
  );
  assert.doesNotMatch(
    JSON.stringify(observer.snapshot()),
    /192\.0\.2|2001:db8|private|if8/,
  );
  await observer.stop();
});

test("Docker observer bounds safe projections, ignores arbitrary labels and cleans once", async () => {
  const child = fake();
  let stops = 0;
  const now = () => 10000;
  const observer = diagnostics.startPublicDockerObserver({
    spawnProcess: (command, args) => {
      assert.equal(command, "docker");
      assert.deepEqual(args.slice(0, 3), ["events", "--format", "{{json .}}"]);
      assert.ok(args.includes("--until"));
      return child;
    },
    terminate: async () => {
      stops++;
    },
    now,
  });
  child.emit("spawn");
  const send = (service, extra = {}) =>
    child.stdout.write(
      JSON.stringify({
        Type: "container",
        Action: "start",
        time: 10,
        Actor: {
          ID: "private-id",
          Attributes: {
            "com.docker.compose.service": service,
            password: "private-token",
          },
        },
        ...extra,
      }) + "\n",
    );
  send("api");
  send("private-service");
  send("web", { Action: "private-action" });
  child.stdout.write("private-not-json\n" + "x".repeat(70000) + "\n");
  for (let i = 0; i < 205; i++) send(i === 204 ? "ingress" : "web");
  const state = observer.snapshot();
  assert.equal(state.events.length, 200);
  assert.equal(state.events.at(-1).service, "ingress");
  assert.ok(state.dropped > 0);
  assert.equal(state.status, "OBSERVING");
  assert.doesNotMatch(JSON.stringify(state), /private|password|192\.0/);
  assert.deepEqual(Object.keys(state.events[0]).sort(), [
    "Action",
    "Type",
    "atUTC",
    "service",
  ]);
  await observer.stop();
  await observer.stop();
  assert.equal(stops, 1);
  assert.equal(observer.snapshot().status, "STOPPED");
});

test("Docker observer exposes missing tool, early exit, bounded lifetime and no raw errors", async () => {
  const missing = diagnostics.startPublicDockerObserver({
    spawnProcess: () => {
      throw Error("private");
    },
  });
  assert.equal(missing.snapshot().status, "UNAVAILABLE");
  await missing.stop();
  const child = fake();
  let terminated = 0;
  const observer = diagnostics.startPublicDockerObserver({
    spawnProcess: () => child,
    terminate: async () => {
      terminated++;
    },
    durationMs: 15,
  });
  child.emit("spawn");
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(terminated, 1);
  assert.equal(observer.snapshot().status, "STOPPED");
  const dead = fake();
  const early = diagnostics.startPublicDockerObserver({
    spawnProcess: () => dead,
    terminate: async () => {},
  });
  dead.emit("exit", 1, null);
  assert.equal(early.snapshot().reason, "EXITED");
  await early.stop();
  assert.doesNotMatch(JSON.stringify(early.snapshot()), /private/);
});

test("failure window uses failed request interval plus/minus five seconds; no causal assertion", () => {
  const event = (t) => ({
    category: "ADDR",
    interfaceGroup: "bridge",
    atUTC: new Date(t).toISOString(),
    elapsedMs: t,
  });
  const environment = {
    network: {
      status: "OBSERVING",
      events: [event(4999), event(5000), event(15008), event(15009)],
      dropped: 0,
    },
    docker: {
      status: "OBSERVING",
      events: [
        {
          Type: "container",
          Action: "start",
          service: "api",
          atUTC: new Date(10001).toISOString(),
        },
      ],
      dropped: 0,
    },
  };
  const request = {
    endpoint: "OPERATOR_SETUP_LINK",
    startedUTC: new Date(10000).toISOString(),
    elapsedMs: 8,
    failed: true,
  };
  const row = diagnostics.publicEnvironmentFailureWindow(
    environment,
    { requests: [request], scriptFailures: [] },
    20000,
  );
  assert.equal(row.windowSource, "FAILED_AUTH_REQUEST");
  assert.equal(row.network.events.length, 2);
  assert.equal(row.docker.events[0].service, "api");
  assert.equal(
    diagnostics.publicEnvironmentFailureWindow(
      environment,
      {
        requests: [],
        scriptFailures: [{ failedUTC: new Date(10000).toISOString() }],
      },
      20000,
    ).windowSource,
    "FAILED_SCRIPT",
  );
  assert.equal(
    diagnostics.publicEnvironmentFailureWindow(
      environment,
      { requests: [], scriptFailures: [] },
      20000,
    ).windowSource,
    "FAILURE_TIMESTAMP",
  );
});
