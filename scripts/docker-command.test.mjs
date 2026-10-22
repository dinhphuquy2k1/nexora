import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, chmod, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";
import { spawn } from "node:child_process";
import { dockerCommand } from "./docker-command.mjs";
test("bounded Docker process preserves exit/stdin and handles timeout, signal request and spawn failure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexora-command-")),
    old = process.env.PATH;
  try {
    await writeFile(
      join(dir, "docker"),
      `#!/usr/bin/env node\nif(process.argv[2]==='slow')setTimeout(()=>{},10000);else{let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{process.stdout.write(input);process.exit(17);});}`,
    );
    await chmod(join(dir, "docker"), 0o755);
    process.env.PATH = dir + delimiter + old;
    const r = await dockerCommand(["echo"], { data: "synthetic input" });
    assert.equal(r.code, 17);
    assert.equal(r.stdout, "synthetic input");
    await assert.rejects(
      dockerCommand(["slow"], { timeout: 80 }),
      /DOCKER_COMMAND_TIMEOUT/,
    );
    await assert.rejects(
      dockerCommand(["slow"], { interrupted: () => 15 }),
      /INTERRUPTED signal=15/,
    );
    process.env.PATH = dir + "/absent";
    await assert.rejects(dockerCommand([]), /DOCKER_COMMAND_UNAVAILABLE/);
  } finally {
    process.env.PATH = old;
    await rm(dir, { recursive: true, force: true });
  }
});
test("maintenance smoke refuses to remove a container with an unowned label", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexora-cleanup-negative-"));
  try {
    const state = join(dir, "calls");
    const file = join(dir, "docker");
    await writeFile(
      file,
      `#!/usr/bin/env node\nconst fs=require('node:fs');fs.appendFileSync(process.env.NEXORA_FIXTURE_CALLS,process.argv.slice(2).join(' ')+'\\n');if(process.argv[2]==='create')console.log('a'.repeat(64));else if(process.argv[2]==='inspect')console.log(JSON.stringify([{Id:'a'.repeat(64),Name:'/unowned',Config:{Labels:{'nexora.cleanup-test':'other-run'}}}]));else process.exit(2);`,
    );
    await chmod(file, 0o755);
    const p = spawn(process.execPath, ["scripts/dev-cleanup-smoke.mjs"], {
      env: {
        ...process.env,
        PATH: dir + delimiter + process.env.PATH,
        NEXORA_FIXTURE_CALLS: state,
      },
    });
    let output = "";
    p.stderr.on("data", (c) => (output += c));
    p.stdout.resume();
    const code = await new Promise((r) => p.on("close", r));
    assert.notEqual(code, 0);
    assert.match(output, /CLEANUP_UNVERIFIED/);
    assert.doesNotMatch(await readFile(state, "utf8"), /^rm /m);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
