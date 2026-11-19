import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  projectPublicPreexistingContainers,
  capturePublicPreexistingContainers,
} from "./public-https-diagnostics.mjs";

const sample = (extra = {}) => ({
  ID: "private-container-id",
  Names: "private-full-name",
  Image: "private-image",
  Ports: "private-address",
  Mounts: "private-mount",
  Networks: "private-network",
  Labels:
    "com.docker.compose.project=nexora-ci,com.docker.compose.service=api,private.token=private-secret",
  State: "running",
  Status: "Up 2 minutes (healthy)",
  ...extra,
});
test("preexisting containers retain exactly four safe fields and at most100 rows", () => {
  const result = projectPublicPreexistingContainers(
    Array.from({ length: 105 }, () => JSON.stringify(sample())).join("\n"),
  );
  assert.equal(result.status, "OBSERVED");
  assert.equal(result.containers.length, 100);
  assert.deepEqual(result.containers[0], {
    "com.docker.compose.project": "nexora-ci",
    "com.docker.compose.service": "api",
    State: "running",
    Status: "Up 2 minutes (healthy)",
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    /private|container-id|full-name|image|address|mount|network|secret/,
  );
});
test("unknown labels/status are projected, absent labels remain absent, raw faults never escape", () => {
  const result = projectPublicPreexistingContainers(
    [
      sample({
        Labels:
          "com.docker.compose.project=private-secret,com.docker.compose.service=private-service",
        Status: "private-cookie",
        State: "private-state",
      }),
      sample({
        Labels: "",
        State: "exited",
        Status: "Exited (0) 4 seconds ago",
      }),
      sample({
        Labels:
          "com.docker.compose.project=nexora-smoke-123,com.docker.compose.service=web",
        Status: "Up About a minute",
      }),
    ]
      .map(JSON.stringify)
      .join("\n"),
  );
  assert.deepEqual(result.containers[0], {
    "com.docker.compose.project": "other",
    "com.docker.compose.service": "other",
    State: "other",
    Status: "other",
  });
  assert.equal(result.containers[1]["com.docker.compose.project"], null);
  assert.equal(result.containers[1].Status, "Exited (0) 4 seconds ago");
  assert.equal(
    result.containers[2]["com.docker.compose.project"],
    "nexora-smoke-123",
  );
  assert.deepEqual(projectPublicPreexistingContainers("private-not-json"), {
    status: "UNAVAILABLE",
  });
  assert.deepEqual(projectPublicPreexistingContainers(""), {
    status: "OBSERVED",
    containers: [],
  });
});
test("docker ps is read-only and bounded; command and parse errors are UNAVAILABLE", () => {
  const result = capturePublicPreexistingContainers({
    run: (command, args, options) => {
      assert.equal(command, "docker");
      assert.deepEqual(args, ["ps", "-a", "--format", "{{json .}}"]);
      assert.ok(options.timeout > 0 && options.timeout <= 5000);
      assert.ok(options.maxBuffer <= 1048576);
      return { status: 0, stdout: JSON.stringify(sample()) };
    },
  });
  assert.equal(result.containers[0].State, "running");
  for (const run of [
    () => {
      throw Error("private");
    },
    () => ({ status: 1, stdout: "private" }),
    () => ({ status: 0, stdout: "invalid" }),
    () => ({ status: null, error: Error("private") }),
  ])
    assert.deepEqual(capturePublicPreexistingContainers({ run }), {
      status: "UNAVAILABLE",
    });
});
test("CLI missing Docker writes UNAVAILABLE and exits successfully without raw errors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "preexisting-"));
  try {
    const path = join(dir, "preexisting-containers.json");
    const output = execFileSync(
      process.execPath,
      ["scripts/public-https-preexisting.mjs", path],
      { env: { ...process.env, PATH: dir }, encoding: "utf8" },
    );
    assert.equal(output, "");
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), {
      status: "UNAVAILABLE",
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
