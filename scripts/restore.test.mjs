import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function harness(t, failure) {
  const dir = await mkdtemp(join(tmpdir(), "nexora-restore-unit-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const backup = join(dir, "backup");
  await mkdir(backup);
  await writeFile(join(backup, "database.dump"), "fixture");
  await writeFile(join(backup, "uploads.tar.gz"), "fixture");
  const log = join(dir, "commands.jsonl");
  await writeFile(
    join(dir, "docker"),
    `#!/usr/bin/env node
const fs=require('node:fs');
const args=process.argv.slice(2);
fs.appendFileSync(process.env.RESTORE_TEST_LOG,JSON.stringify(args)+'\\n');
const joined=args.join(' ');
if(args[0]==='ps' && process.env.RESTORE_TEST_FAILURE==='existing-container'){console.log('fixture-container');process.exit(0);}
if(args[0]==='volume')process.exit(process.env.RESTORE_TEST_FAILURE==='existing-volume'?0:1);
if(joined.includes('pg_restore') && process.env.RESTORE_TEST_FAILURE==='dump') process.exit(1);
if(joined.includes(' run ') && args.at(-1)==='migrate' && process.env.RESTORE_TEST_FAILURE==='migration') process.exit(1);
if(joined.includes('DELETE FROM public.sessions') && process.env.RESTORE_TEST_FAILURE==='sessions') process.exit(1);
if(args[0]==='run' && args.at(-1)==='verify' && process.env.RESTORE_TEST_FAILURE==='manifest') process.exit(1);
if(args.at(-1)==='node') {process.stdin.resume();process.stdin.on('end',()=>process.exit(process.env.RESTORE_TEST_FAILURE==='integrity'?1:0));}
`,
    { mode: 0o755 },
  );
  const execute = (project) =>
    spawnSync(
      "sh",
      ["scripts/restore.sh", backup, "--to-new-project", project],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          RESTORE_TEST_LOG: log,
          RESTORE_TEST_FAILURE: failure || "",
          NEXORA_COMPOSE_OVERRIDE: "",
        },
        timeout: 10000,
      },
    );
  const commands = async () =>
    (await readFile(log, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  return { execute, commands };
}

test("restore executes dump → migrations → session invalidation → uploads → integrity before success", async (t) => {
  const h = await harness(t);
  const result = h.execute("nexora-restore-test-target");
  assert.equal(result.status, 0);
  const commands = await h.commands();
  const find = (text) =>
    commands.findIndex((args) => args.join(" ").includes(text));
  const dump = find("pg_restore");
  const migration = commands.findIndex(
    (args) => args.includes("run") && args.at(-1) === "migrate",
  );
  const invalidation = find("DELETE FROM public.sessions");
  const uploads = find("-xzf");
  const integrity = commands.findIndex(
    (args) => args.includes("run") && args.at(-1) === "node",
  );
  assert.ok(
    dump >= 0 &&
      dump < migration &&
      migration < invalidation &&
      invalidation < uploads &&
      uploads < integrity,
  );
  assert.equal(
    commands.some(
      (args) =>
        args.includes("up") && (args.includes("api") || args.includes("web")),
    ),
    false,
  );
  assert.ok(
    commands
      .filter((args) => args[0] === "compose")
      .every((args) => args.includes("nexora-restore-test-target")),
  );
});

for (const failure of ["dump", "migration", "sessions", "integrity"]) {
  test(`restore fails closed at ${failure} without declaring success`, async (t) => {
    const h = await harness(t, failure);
    const result = h.execute("nexora-restore-test-target");
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout.includes("Restored to isolated project"), false);
    const commands = await h.commands();
    assert.equal(
      commands.some(
        (args) =>
          args.includes("down") ||
          (args.includes("volume") && args.includes("rm")),
      ),
      false,
    );
    if (["migration", "sessions"].includes(failure))
      assert.equal(
        commands.some((args) => args.includes("-xzf")),
        false,
      );
  });
}

for (const failure of ["manifest", "existing-volume", "existing-container"]) {
  test(`restore guard ${failure} blocks target creation`, async (t) => {
    const h = await harness(t, failure);
    const result = h.execute("nexora-restore-test-target");
    assert.notEqual(result.status, 0);
    assert.equal(
      (await h.commands()).some((args) => args.includes("up")),
      false,
    );
  });
}

test("restore retains default-project protection", async (t) => {
  const h = await harness(t);
  assert.notEqual(h.execute("nexora").status, 0);
});
