import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { parsePort } from "../scripts/lib/launch-next.mjs";

const scripts = fileURLToPath(new URL("../scripts/", import.meta.url));
const fixture = `
const net = require('node:net');
const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]);
const host = args[args.indexOf('--hostname') + 1];
const announce = () => console.log(JSON.stringify({args,host,port,envPort:process.env.PORT,pid:process.pid}));
if (process.env.TEST_LAUNCH_ACTION === 'wait') {
  const server = net.createServer();
  for (const signal of ['SIGTERM','SIGINT','SIGHUP']) process.on(signal, () => {
    console.log('received-' + signal);
    server.close(() => process.exit(0));
  });
  server.listen(port, host, announce);
} else if (process.env.TEST_LAUNCH_ACTION === 'bind-fail') {
  const owner = net.createServer();
  owner.listen(port, host, () => {
    const contender = net.createServer();
    contender.once('error', (error) => {
      console.error('fixture actual bind failure ' + error.code);
      owner.close(() => process.exit(1));
    });
    contender.listen(port, host);
  });
} else if (process.env.TEST_LAUNCH_ACTION === 'signal') {
  process.kill(process.pid, 'SIGTERM');
} else {
  announce(); process.exit(Number(process.env.TEST_LAUNCH_EXIT || 0));
}
`;

async function temp(t) {
  const cwd = await mkdtemp(join(tmpdir(), "nexora-launcher-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const dir = join(cwd, "node_modules/next/dist/bin");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "next"), fixture);
  return cwd;
}

async function listen() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server;
}

async function unusedPort() {
  const server = await listen();
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function run(t, mode, cwd, env, args = []) {
  const child = spawn(
    process.execPath,
    [...args, join(scripts, mode + ".mjs")],
    {
      cwd,
      env: { ...process.env, HOST: "127.0.0.1", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const completed = once(child, "close").then(([code, signal]) => ({
    code,
    signal,
    stdout,
    stderr,
  }));
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
  });
  return { child, completed, output: () => stdout };
}

test("strict port parser accepts canonical host/Docker/custom ports and boundaries", () => {
  for (const value of ["3001", "3000", "3101", "1", "65535"]) {
    assert.equal(parsePort(value), Number(value));
  }
});

for (const mode of ["dev", "start"]) {
  test(
    `${mode}: strict malformed PORT rejection`,
    { timeout: 15000 },
    async (t) => {
      const cwd = await temp(t);
      for (const port of [
        "3001abc",
        "0",
        "-1",
        "65536",
        "3.5",
        "",
        "   ",
        " 3001 ",
        "1e3",
      ]) {
        const result = await run(t, mode, cwd, { PORT: port }).completed;
        assert.equal(result.code, 1, `PORT ${JSON.stringify(port)} must fail`);
        assert.match(result.stderr, /Invalid PORT/);
        assert.equal(result.stdout, "", "Next must not start for invalid PORT");
      }
    },
  );

  test(
    `${mode}: command, HOST/PORT and exit status propagation`,
    { timeout: 10000 },
    async (t) => {
      const cwd = await temp(t);
      const port = await unusedPort();
      const result = await run(t, mode, cwd, {
        PORT: String(port),
        TEST_LAUNCH_EXIT: "7",
      }).completed;
      assert.equal(result.code, 7);
      assert.equal(
        (
          await run(t, mode, cwd, { PORT: String(port), TEST_LAUNCH_EXIT: "0" })
            .completed
        ).code,
        0,
      );
      const output = JSON.parse(result.stdout.trim());
      assert.deepEqual(output.args, [
        mode,
        ...(mode === "dev" ? ["--webpack"] : []),
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ]);
      assert.equal(output.envPort, String(port));
    },
  );

  test(
    `${mode}: default HOST remains 0.0.0.0`,
    { timeout: 10000 },
    async (t) => {
      const result = await run(t, mode, await temp(t), {
        HOST: "",
        PORT: String(await unusedPort()),
      }).completed;
      assert.equal(result.code, 0);
      assert.equal(JSON.parse(result.stdout.trim()).host, "0.0.0.0");
    },
  );

  test(
    `${mode}: occupied port leaves existing listener untouched`,
    { timeout: 10000 },
    async (t) => {
      const cwd = await temp(t);
      const server = await listen();
      t.after(() => new Promise((resolve) => server.close(resolve)));
      const port = server.address().port;
      const result = await run(t, mode, cwd, { PORT: String(port) }).completed;
      assert.equal(result.code, 1);
      assert.match(result.stderr, new RegExp(`Port ${port} is already in use`));
      assert.equal(result.stdout, "", "No fallback Next process may start");
      const connection = net.connect(port, "127.0.0.1");
      await once(connection, "connect");
      connection.destroy();
      assert.ok(server.listening);
    },
  );

  test(
    `${mode}: spawn failure is sanitized and nonzero`,
    { timeout: 10000 },
    async (t) => {
      const cwd = await temp(t);
      const preload = join(cwd, "missing-node.mjs");
      await writeFile(
        preload,
        "process.execPath = '/nexora-test-nonexistent/node';",
      );
      const result = await run(
        t,
        mode,
        cwd,
        { PORT: String(await unusedPort()) },
        ["--import", preload],
      ).completed;
      assert.equal(result.code, 1);
      assert.match(result.stderr, /Unable to start Next\.js/);
      assert.doesNotMatch(
        result.stderr,
        /Unhandled|node:events|nexora-test-nonexistent/,
      );
    },
  );

  test(
    `${mode}: actual child bind failure is not reported as success`,
    { timeout: 10000 },
    async (t) => {
      const result = await run(t, mode, await temp(t), {
        PORT: String(await unusedPort()),
        TEST_LAUNCH_ACTION: "bind-fail",
      }).completed;
      assert.equal(result.code, 1);
      assert.match(result.stderr, /actual bind failure EADDRINUSE/);
    },
  );

  test(
    `${mode}: signal-terminated child returns nonzero`,
    { timeout: 10000 },
    async (t) => {
      const result = await run(t, mode, await temp(t), {
        PORT: String(await unusedPort()),
        TEST_LAUNCH_ACTION: "signal",
      }).completed;
      assert.equal(result.code, 143);
    },
  );

  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    test(
      `${mode}: forwards ${signal}, waits for child and releases port`,
      { timeout: 15000 },
      async (t) => {
        const port = await unusedPort();
        const launched = run(t, mode, await temp(t), {
          PORT: String(port),
          TEST_LAUNCH_ACTION: "wait",
        });
        let record;
        let childStopped = false;
        while (!launched.output().includes("\n"))
          await once(launched.child.stdout, "data");
        record = JSON.parse(launched.output().split("\n")[0]);
        t.after(() => {
          if (childStopped) return;
          try {
            process.kill(record.pid, "SIGKILL");
          } catch (error) {
            if (error.code !== "ESRCH") throw error;
          }
        });
        launched.child.kill(signal);
        const result = await launched.completed;
        assert.match(result.stdout, new RegExp(`received-${signal}`));
        assert.equal(
          result.code,
          { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 }[signal],
        );
        assert.throws(() => process.kill(record.pid, 0), { code: "ESRCH" });
        childStopped = true;
        const probe = net.createServer();
        await new Promise((resolve, reject) => {
          probe.once("error", reject);
          probe.listen(port, "127.0.0.1", resolve);
        });
        await new Promise((resolve) => probe.close(resolve));
      },
    );
  }
}
