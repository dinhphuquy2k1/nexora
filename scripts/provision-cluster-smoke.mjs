import { performance } from "node:perf_hooks";
// Owned disposable PostgreSQL orchestration. No deployment URL is accepted.
import { dockerCommand } from "./docker-command.mjs";
import { randomBytes } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runId = randomBytes(6).toString("hex"),
  name = `nexora-prov-${runId}`,
  net = `nexora-net-${runId}`;
const token = `cluster-token-${randomBytes(16).toString("hex")}`,
  adminPass = `adm-${randomBytes(32).toString("hex")}`,
  runtimePass = randomBytes(32).toString("hex");
const owned = { container: new Set(), network: new Set() },
  pending = [];
let step = "START",
  interrupted;
const handlers = new Map([
  [
    "SIGINT",
    () => {
      interrupted ??= 2;
    },
  ],
  [
    "SIGTERM",
    () => {
      interrupted ??= 15;
    },
  ],
]);
function safe(value) {
  let s = String(value);
  for (const secret of [adminPass, runtimePass, token])
    s = s.replaceAll(secret, "[REDACTED]");
  return s.replace(/postgres(?:ql)?:\/\/[^\s'"]+/g, "[REDACTED_URL]");
}
function check() {
  if (interrupted) throw Error(`INTERRUPTED signal=${interrupted}`);
}
function command(args, options = {}) {
  return dockerCommand(args, {
    ...options,
    interrupted: () => (options.interruptible ? interrupted : undefined),
  });
}
async function inspect(kind, identity) {
  const r = await command(
    kind === "container"
      ? ["inspect", "--type", "container", identity]
      : ["network", "inspect", identity],
    { timeout: 5000 },
  );
  if (r.code === 0) {
    try {
      const a = JSON.parse(r.stdout);
      if (a.length === 1 && a[0].Id === identity) return a[0];
    } catch {
      /* unverifiable */
    }
    throw Error("INSPECT_UNVERIFIABLE");
  }
  const missing = [
    `No such object: ${identity}`,
    `Error: No such object: ${identity}`,
    `Error response from daemon: No such object: ${identity}`,
    `network ${identity} not found`,
    `Error response from daemon: network ${identity} not found`,
    `Error response from daemon: No such container: ${identity}`,
    `Error: No such container: ${identity}`,
  ];
  if (r.code === 1 && missing.includes(r.stderr.trim())) return null;
  throw Error("INSPECT_UNVERIFIABLE");
}
async function recover(item) {
  const [kind, resourceName] = item;
  try {
    const r = await command(
      kind === "container"
        ? ["inspect", resourceName]
        : ["network", "inspect", resourceName],
      { timeout: 5000 },
    );
    if (r.code !== 0) {
      const allowed = [
        `No such object: ${resourceName}`,
        `Error: No such object: ${resourceName}`,
        `Error response from daemon: No such object: ${resourceName}`,
        `Error response from daemon: network ${resourceName} not found`,
      ];
      if (r.code === 1 && allowed.includes(r.stderr.trim())) {
        pending.splice(pending.indexOf(item), 1);
        return;
      }
      throw Error("creation unable-to-verify");
    }
    const a = JSON.parse(r.stdout);
    const state = a[0];
    const labels = kind === "container" ? state.Config?.Labels : state.Labels;
    if (
      labels?.["nexora.cluster-test"] !== runId ||
      !/^[a-f0-9]{64}$/.test(state.Id)
    )
      throw Error("creation ownership unverified");
    owned[kind].add(state.Id);
    pending.splice(pending.indexOf(item), 1);
  } catch {
    return `${kind} ${resourceName} creation unable-to-verify`;
  }
}
async function create(args, kind, resourceName) {
  const item = [kind, resourceName];
  pending.push(item);
  let r;
  try {
    r = await command(args);
  } catch (e) {
    await recover(item);
    throw e;
  }
  const identity = r.stdout.trim();
  if (!/^[a-f0-9]{64}$/.test(identity)) {
    await recover(item);
    throw Error("CREATE_FAILED ownership recovery attempted");
  }
  // Verify returned IDs and per-run labels before treating them as owned.
  const state = await inspect(kind, identity);
  const labels = kind === "container" ? state?.Config?.Labels : state?.Labels;
  if (labels?.["nexora.cluster-test"] !== runId) {
    await recover(item);
    throw Error("CLUSTER_OWNERSHIP_UNVERIFIED");
  }
  owned[kind].add(identity);
  pending.splice(pending.indexOf(item), 1);
  if (r.code !== 0) throw Error("CREATE_FAILED");
  check();
  return identity;
}
async function remove(kind, identity) {
  try {
    const r = await command(
      kind === "container"
        ? ["rm", "-fv", identity]
        : ["network", "rm", identity],
      { timeout: 10000 },
    );
    if (await inspect(kind, identity))
      return `${kind} ${identity} still exists; remove_exit=${r.code}`;
    owned[kind].delete(identity);
  } catch (e) {
    return `${kind} ${identity} unable-to-verify ${e.message}`;
  }
}
async function cleanup() {
  const errors = [];
  for (const item of [...pending]) {
    const e = await recover(item);
    if (e) errors.push(e);
  }
  for (const kind of ["container", "network"])
    for (const id of [...owned[kind]]) {
      const e = await remove(kind, id);
      if (e) errors.push(e);
    }
  return errors;
}
async function psql(id, sql, timeout = 5000) {
  return command(
    [
      "exec",
      "-i",
      id,
      "sh",
      "-c",
      'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -h "$1" -p 5432 -v ON_ERROR_STOP=1 -U nexora -d nexora -Atq',
      "sh",
      name,
    ],
    { data: sql, timeout },
  );
}
async function waitTcp(id) {
  const deadline = performance.now() + 30000;
  while (performance.now() < deadline) {
    check();
    const remaining = deadline - performance.now();
    let state, r;
    try {
      state = await inspect("container", id);
      if (!state?.State?.Running) throw Error("POSTGRES_STARTUP_FAILED");
      r = await psql(id, "SELECT 1;", Math.min(5000, remaining));
    } catch (e) {
      if (e.message === "DOCKER_COMMAND_TIMEOUT")
        throw Error("TCP_READINESS_TIMEOUT", { cause: e });
      throw e;
    }
    if (r.code === 0 && r.stdout.trim() === "1") {
      check();
      return;
    }
    await new Promise((r) =>
      setTimeout(r, Math.min(200, Math.max(0, deadline - performance.now()))),
    );
  }
  throw Error("TCP_READINESS_TIMEOUT");
}
function suiteFailure(suite, result, exit) {
  const output = result.stdout + result.stderr;
  const categories = [
    "ERR_ASSERTION",
    "AssertionError",
    "MODULE_NOT_FOUND",
    "DISPOSABLE_CLUSTER_REQUIRED",
    "CLUSTER_OWNERSHIP_UNVERIFIED",
    "NETWORK_TCP_QUERY_FAILED",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
  ].filter((c) => output.includes(c));
  const states = [...output.matchAll(/code:\s*['"]([0-9A-Z]{5})['"]/g)].map(
    (m) => m[1],
  );
  return Error(
    `SUITE_FAILED suite=${suite} attach_exit=${result.code} container_exit=${exit} categories=${categories} sqlstates=${states}`,
  );
}
async function runSuites(suite) {
  const suites = {
    provision: ["node", "packages/database/test/provision-cluster.mjs"],
    "customer-sql": [
      "node",
      "--test",
      "packages/database/test/customer-sql.mjs",
    ],
  };
  if (suite !== undefined && !Object.hasOwn(suites, suite))
    throw Error("INVALID_SUITE");
  step = "CREATE_NETWORK";
  await create(
    ["network", "create", "--label", `nexora.cluster-test=${runId}`, net],
    "network",
    net,
  );
  step = "CREATE_POSTGRES";
  const id = await create(
    [
      "create",
      "--name",
      name,
      "--label",
      `nexora.cluster-test=${runId}`,
      "--network",
      net,
      "-e",
      "POSTGRES_USER=nexora",
      "-e",
      "POSTGRES_DB=nexora",
      "-e",
      `POSTGRES_PASSWORD=${adminPass}`,
      "postgres:17.11-bookworm",
    ],
    "container",
    name,
  );
  step = "START_POSTGRES";
  if ((await command(["start", id])).code !== 0)
    throw Error("POSTGRES_STARTUP_FAILED");
  step = "VERIFY_OWNERSHIP";
  const state = await inspect("container", id);
  if (
    state?.Name !== `/${name}` ||
    state.Config?.Image !== "postgres:17.11-bookworm" ||
    !Object.hasOwn(state.NetworkSettings?.Networks ?? {}, net)
  )
    throw Error("CLUSTER_OWNERSHIP_UNVERIFIED");
  step = "POLL_TCP_READINESS";
  await waitTcp(id);
  step = "STAMP_SIGNATURE";
  if ((await psql(id, `COMMENT ON DATABASE nexora IS '${token}';`)).code !== 0)
    throw Error("STAMP_FAILED");
  step = "VERIFY_TOOLING_IMAGE";
  check();
  if (
    (await command(["image", "inspect", "nexora-dev:0.1.0"])).code !== 0 &&
    (
      await command([
        "build",
        "-f",
        "docker/Dockerfile.tools",
        "--target",
        "dev",
        "-t",
        "nexora-dev:0.1.0",
        ".",
      ])
    ).code !== 0
  )
    throw Error("TOOLING_BUILD_FAILED");
  const adminUrl = `postgresql://nexora:${adminPass}@${name}:5432/nexora`;
  const probe = `const {Client}=require('/workspace/packages/database/node_modules/pg');(async()=>{const c=new Client({connectionString:process.env.DISPOSABLE_CLUSTER_ADMIN_URL});try{await c.connect();const r=await c.query('SELECT 1 AS ready');if(r.rows[0]?.ready!==1)throw Error();}catch{console.error('NETWORK_TCP_QUERY_FAILED');process.exitCode=1;}finally{await c.end().catch(()=>{});}})();`;
  for (const key of suite === undefined ? Object.keys(suites) : [suite]) {
    check();
    step = `EXECUTE_SUITE_${key.toUpperCase()}`;
    const testName = `nexora-test-${runId}-${key}`;
    const args = [
      "create",
      "--name",
      testName,
      "--label",
      `nexora.cluster-test=${runId}`,
      "--network",
      net,
      "-e",
      `DISPOSABLE_CLUSTER_ADMIN_URL=${adminUrl}`,
      "-e",
      `DISPOSABLE_CLUSTER_TOKEN=${token}`,
      "-e",
      `DISPOSABLE_CLUSTER_RUNTIME_PASSWORD=${runtimePass}`,
    ];
    for (const dir of ["test", "scripts", "prisma"])
      args.push(
        "-v",
        `${root}/packages/database/${dir}:/workspace/packages/database/${dir}:ro`,
      );
    args.push(
      "--entrypoint",
      "sh",
      "nexora-dev:0.1.0",
      "-c",
      'node -e "$1" && shift && exec "$@"',
      "sh",
      probe,
      ...suites[key],
    );
    const testId = await create(args, "container", testName);
    const result = await command(["start", "-a", testId], {
      timeout: 180000,
      interruptible: true,
    });
    if (result.code !== 0) throw suiteFailure(key, result);
    const exit = (await inspect("container", testId))?.State?.ExitCode;
    if (!Number.isInteger(exit)) throw Error("SUITE_EXIT_UNVERIFIABLE");
    if (exit !== 0) throw suiteFailure(key, result, exit);
    if (result.stdout) console.log(safe(result.stdout.trim()));
    check();
    const error = await remove("container", testId);
    if (error) throw Error(`CLEANUP_FAILED: ${error}`);
  }
}
export async function main(args = process.argv.slice(2)) {
  for (const [sig, handler] of handlers) process.on(sig, handler);
  let failure, errors;
  try {
    if (args.length > 1 || (args.length && !args[0].startsWith("--suite=")))
      throw Error("INVALID_SUITE");
    await runSuites(args[0]?.slice(8));
    check();
  } catch (e) {
    failure = e;
    console.error(
      safe(`PROVISION_CLUSTER_SMOKE_FAILED step=${step} err=${e.message}`),
    );
  } finally {
    errors = await cleanup();
    for (const [sig, handler] of handlers) process.off(sig, handler);
    if (errors.length)
      console.error(safe(`CLEANUP_FAILED: ${errors.join("; ")}`));
  }
  if (interrupted) return 128 + interrupted;
  if (failure || errors.length) return 1;
  console.log(
    "Actual disposable cluster tests PASS (all requested suites and cleanup verified)",
  );
  return 0;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  process.exitCode = await main();
