import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const roots = ["apps/api/openapi", "packages/sdk/src/generated"];
async function snapshot() {
  const result = {};
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) await walk(p);
      else
        result[p] = createHash("sha256")
          .update(await readFile(p))
          .digest("hex");
    }
  }
  for (const r of roots) await walk(r);
  return result;
}
const before = await snapshot();
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
execFileSync(pnpmCmd, ["contracts:generate"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
const after = await snapshot();
if (JSON.stringify(before) !== JSON.stringify(after))
  throw Error("Contract drift: generated content or file set changed");
// Snapshot comparison detects new files even when the working tree has no HEAD yet.
try {
  execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  const changed = execFileSync(
    "git",
    ["status", "--porcelain", "--", ...roots],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  if (changed.trim())
    throw Error(
      "Uncommitted contract drift (including untracked files): " + changed,
    );
} catch (e) {
  if (e instanceof Error && e.message.startsWith("Uncommitted")) throw e;
}
console.log("Contracts reproducible PASS");
