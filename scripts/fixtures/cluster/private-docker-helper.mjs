// Test-only private copy: never fall through to an installed Docker executable.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
export async function writeDockerFixtureHelper(directory, fixture, timeout) {
  let source = await readFile(
    new URL("../../docker-command.mjs", import.meta.url),
    "utf8",
  );
  assert.ok(source.includes('spawn("docker", args,'));
  source = source.replace(
    'spawn("docker", args,',
    `spawn(process.execPath, [${JSON.stringify(fixture)}, ...args],`,
  );
  if (timeout)
    source = source.replace("timeout = 120000", `timeout = ${timeout}`);
  const file = join(directory, "docker-command.mjs");
  await writeFile(file, source);
  return file;
}
