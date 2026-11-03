const { test } = require("node:test");
const { setTimeout, clearTimeout } = require("node:timers");
const assert = require("node:assert/strict");
const { spawnSync, spawn } = require("node:child_process");
const { resolve } = require("node:path");
const { createServer } = require("node:net");
const { Prisma } = require("@nexora/database");
const {
  logWorkerFailure,
} = require("../../dist/sync/infrastructure/worker-failure-log");
const {
  SyncConfigurationError,
} = require("../../dist/sync/domain/sync-policy");
const secret = "PRIVATE_PASSWORD_TOKEN_SQL_PAYLOAD";
function capture(error, event = "sync_worker_cycle_failed") {
  const write = console.error,
    lines = [];
  console.error = (line) => lines.push(line);
  try {
    logWorkerFailure(event, error);
  } finally {
    console.error = write;
  }
  assert.equal(lines.length, 1);
  assert.equal(lines[0].includes(secret), false);
  const value = JSON.parse(lines[0]);
  assert.deepEqual(
    Object.keys(value).sort(),
    value.errorCode
      ? ["code", "errorCode", "errorType", "event"]
      : ["code", "errorType", "event"],
  );
  assert.equal(value.code, "INTERNAL_ERROR");
  return value;
}
test("worker diagnostics allow actual Prisma classes and closed Node/database codes only", () => {
  const known = new Prisma.PrismaClientKnownRequestError(secret, {
    code: "P2010",
    clientVersion: "test",
    meta: { query: secret },
  });
  assert.deepEqual(capture(known), {
    event: "sync_worker_cycle_failed",
    code: "INTERNAL_ERROR",
    errorType: "PrismaClientKnownRequestError",
    errorCode: "P2010",
  });
  const init = new Prisma.PrismaClientInitializationError(
    secret,
    "test",
    "P1001",
  );
  assert.equal(capture(init).errorCode, "P1001");
  for (const [code, type] of [
    ["ECONNREFUSED", "NODE_ERROR"],
    ["55P03", "DATABASE_ERROR"],
  ]) {
    const e = new Error(secret);
    e.code = code;
    assert.equal(capture(e).errorType, type);
    assert.equal(capture(e).errorCode, code);
  }
  assert.equal(
    capture(new SyncConfigurationError(secret), "sync_worker_startup_failed")
      .errorType,
    "CONFIGURATION_ERROR",
  );
});
test("worker diagnostics reject unknown/spoofed/secret-bearing codes and non-Error values without reading messages/stacks", () => {
  const bad = new Prisma.PrismaClientKnownRequestError(secret, {
    code: "P2010_" + secret,
    clientVersion: "test",
  });
  const spoof = new Error(secret);
  spoof.name = "PrismaClientKnownRequestError";
  spoof.code = "P2010";
  const getter = new Error(secret);
  Object.defineProperty(getter, "code", {
    get() {
      throw Error(secret);
    },
  });
  for (const e of [
    new Error(secret),
    secret,
    { name: "Error", code: secret },
    null,
    bad,
    spoof,
    getter,
  ])
    assert.deepEqual(capture(e), {
      event: "sync_worker_cycle_failed",
      code: "INTERNAL_ERROR",
      errorType: "UNKNOWN_ERROR",
    });
});
test("actual compiled worker startup emits only safe configuration diagnostics", () => {
  const env = {
    ...process.env,
    SYNC_ENABLED: "invalid",
    DATABASE_URL: "postgresql://user:" + secret + "@127.0.0.1:1/test",
  };
  const result = spawnSync(
    process.execPath,
    [resolve(__dirname, "../../dist/worker/main.js")],
    { env, encoding: "utf8", timeout: 10000 },
  );
  assert.equal(result.status, 1);
  const text = result.stdout + result.stderr;
  assert.equal(text.includes(secret), false);
  const log = text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .find((line) => line.event === "sync_worker_startup_failed");
  assert.equal(log.errorType, "CONFIGURATION_ERROR");
  assert.equal(log.code, "INTERNAL_ERROR");
});
test("actual compiled worker cycle emits safe database diagnostics then shuts down", async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  await new Promise((r) => server.close(r));
  const child = spawn(
    process.execPath,
    [resolve(__dirname, "../../dist/worker/main.js")],
    {
      env: {
        ...process.env,
        DATABASE_URL:
          "postgresql://user:" + secret + "@127.0.0.1:" + port + "/test",
        SYNC_ENABLED: "true",
        SYNC_SHIPMENT_ENABLED: "true",
        SYNC_POLL_MS: "100",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "",
    timer;
  const exit = new Promise((r) =>
    child.once("exit", (code, signal) => r({ code, signal })),
  );
  try {
    const log = await new Promise((yes, no) => {
      timer = setTimeout(() => no(Error("WORKER_CYCLE_NOT_OBSERVED")), 10000);
      child.stdout.on("data", (b) => (output += b));
      child.stderr.on("data", (b) => {
        output += b;
        for (const line of output.split("\n")) {
          try {
            const v = JSON.parse(line);
            if (v.event === "sync_worker_cycle_failed") yes(v);
          } catch {
            /* Wait for a complete JSON line. */
          }
        }
      });
      child.once("error", no);
    });
    assert.equal(output.includes(secret), false);
    assert.equal(log.code, "INTERNAL_ERROR");
    assert.notEqual(log.errorType, "UNKNOWN_ERROR");
  } finally {
    clearTimeout(timer);
    child.kill("SIGTERM");
    const stop = setTimeout(() => child.kill("SIGKILL"), 5000);
    await exit;
    clearTimeout(stop);
  }
});

test("worker diagnostic code allowlists cannot be bypassed by changing getters on actual error classes", () => {
  const { SyncError } = require("../../dist/sync/domain/sync-policy");
  for (const [error, field, allowed, safeReads] of [
    [
      new Prisma.PrismaClientKnownRequestError(secret, {
        code: "P2010",
        clientVersion: "test",
      }),
      "code",
      "P2010",
      1,
    ],
    [new SyncError("SOURCE_CONFLICT"), "code", "SOURCE_CONFLICT", 1],
    [
      new Prisma.PrismaClientInitializationError(secret, "test", "P1001"),
      "errorCode",
      "P1001",
      2,
    ],
    [new Error(secret), "code", "ECONNREFUSED", 1],
  ]) {
    let reads = 0;
    Object.defineProperty(error, field, {
      get() {
        return ++reads <= safeReads ? allowed : secret;
      },
    });
    const log = capture(error);
    assert.equal(log.errorCode, allowed);
    assert.equal(
      reads,
      1,
      "validate and serialize exactly the same primitive snapshot",
    );
  }
});
test("unknown changing code getters stay unknown after a single read", () => {
  const { SyncError } = require("../../dist/sync/domain/sync-policy");
  for (const [error, field] of [
    [new SyncError("SOURCE_CONFLICT"), "code"],
    [
      new Prisma.PrismaClientKnownRequestError(secret, {
        code: "P2010",
        clientVersion: "test",
      }),
      "code",
    ],
    [
      new Prisma.PrismaClientInitializationError(secret, "test", "P1001"),
      "errorCode",
    ],
  ]) {
    let reads = 0;
    Object.defineProperty(error, field, {
      get() {
        return ++reads === 1 ? secret : "ECONNREFUSED";
      },
    });
    assert.equal(capture(error).errorType, "UNKNOWN_ERROR");
    assert.equal(reads, 1);
  }
});
