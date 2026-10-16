const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { runEnrollment } = require("../dist/cli/mfa-enroll");
const { totpAt } = require("../dist/identity/infrastructure/totp");
function decode32(s) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0,
    v = 0,
    out = [];
  for (const c of s) {
    v = (v << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((v >>> bits) & 255);
    }
  }
  return Buffer.from(out);
}
test("CLI recovery output follows successful commit only; cancellation/failure never prints codes", async () => {
  for (const mode of ["success", "rollback", "cancel"]) {
    let output = "",
      committed = false,
      hashes;
    const adapter = {
      enrollmentIdentity: async () => ({
        id: "fixture",
        passwordHash: "verified",
      }),
      enroll: async (_id, _hash, _secret, _step, h) => {
        assert.equal(output.includes("MFA enrollment committed"), false);
        hashes = h;
        if (mode === "rollback") throw Error("controlled rollback");
        committed = true;
      },
    };
    const promise = runEnrollment(
      adapter,
      async (_prompt, hidden) => {
        assert.equal(hidden, true);
        if (mode === "cancel") throw Error("cancelled");
        const key = /TOTP setup key: ([A-Z2-7]+)/.exec(output)[1];
        return totpAt(decode32(key), Math.floor(Date.now() / 30000));
      },
      (text) => {
        if (text.includes("MFA enrollment committed"))
          assert.equal(committed, true);
        output += text;
      },
      "fixture",
      "fixture password",
    );
    if (mode === "success") {
      await promise;
      assert.equal(hashes.length, 10);
      assert.equal(new Set(hashes).size, 10);
      assert.equal(
        (output.match(/^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/gm) || []).length,
        10,
      );
    } else {
      await assert.rejects(promise);
      assert.equal(output.includes("MFA enrollment committed"), false);
      assert.equal(
        (output.match(/^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/gm) || []).length,
        0,
      );
    }
  }
});
test("MFA CLI rejects non-TTY and secret/code arguments without echoing them", () => {
  const marker = "forbidden-sensitive-argument";
  for (const args of [[], ["--password", marker], ["--code", marker]]) {
    const p = spawnSync(process.execPath, ["dist/cli/mfa-enroll.js", ...args], {
      cwd: require("node:path").resolve(__dirname, ".."),
      input: "forbidden-input",
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test",
      },
    });
    assert.equal(p.status, 1);
    assert.equal((p.stdout + p.stderr).includes(marker), false);
    assert.equal((p.stdout + p.stderr).includes("forbidden-input"), false);
  }
});
