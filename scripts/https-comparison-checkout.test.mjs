import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  stat,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

test("actual comparison checkout retrieves the pinned tree absent from a shallow caller", async () => {
  const root = await mkdtemp(join(tmpdir(), "nexora-comparison-checkout-"));
  try {
    const source = join(root, "source");
    const caller = join(root, "shallow-caller");
    const checkout = join(root, "detached checkout");
    const config = join(root, "empty-gitconfig");
    await writeFile(config, "");
    const env = {
      ...process.env,
      GIT_CONFIG_GLOBAL: config,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
    };
    const git = (...args) => spawnSync("git", args, { env, encoding: "utf8" });
    const success = (...args) => {
      const result = git(...args);
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    await mkdir(source);
    success("init", source);
    success("-C", source, "config", "user.name", "Synthetic fixture");
    success("-C", source, "config", "user.email", "fixture@example.invalid");
    await writeFile(join(source, "state.txt"), "baseline");
    success("-C", source, "add", ".");
    success("-C", source, "commit", "-m", "baseline");
    const baseline = success("-C", source, "rev-parse", "HEAD");
    await writeFile(join(source, "state.txt"), "newer");
    success("-C", source, "commit", "-am", "newer");
    const newer = success("-C", source, "rev-parse", "HEAD");
    const remote = pathToFileURL(source).href;
    success("clone", "--depth=1", remote, caller);
    assert.notEqual(
      git("-C", caller, "cat-file", "-e", `${baseline}^{tree}`).status,
      0,
    );

    const workflow = await readFile(
      new URL(
        "../.github/workflows/https-login-comparison.yml",
        import.meta.url,
      ),
      "utf8",
    );
    const begin = workflow.indexOf('            test ! -e "$checkout"');
    const end = workflow.indexOf(
      "            cp scripts/auth-request-diagnostics.mjs",
      begin,
    );
    assert.ok(begin >= 0 && end > begin);
    // Execute the actual workflow commands; only the remote becomes an owned
    // local fixture. No network, Docker, GitHub token or production resource.
    const commands = workflow
      .slice(begin, end)
      .replace(
        "https://github.com/dinhphuquy2k1/nexora.git",
        "$controlled_remote",
      );
    const result = spawnSync("sh", ["-eu", "-c", commands], {
      cwd: caller,
      env: {
        ...env,
        observer_root: caller,
        checkout,
        revision: baseline,
        controlled_remote: remote,
      },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(success("-C", checkout, "rev-parse", "HEAD"), baseline);
    assert.ok((await stat(join(checkout, ".git"))).isDirectory());
    assert.equal(
      await readFile(join(checkout, "state.txt"), "utf8"),
      "baseline",
    );
    assert.equal(success("-C", caller, "rev-parse", "HEAD"), newer);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
