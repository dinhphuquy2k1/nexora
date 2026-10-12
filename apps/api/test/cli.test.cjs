const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { Readable } = require("node:stream");
const { spawnSync } = require("node:child_process");
const {
  readTerminalLine,
  readPasswordStdin,
} = require("../dist/cli/terminal-input");

function terminal() {
  const input = new EventEmitter();
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (value) => {
    input.isRaw = value;
  };
  input.resume = () => {};
  input.pause = () => {};
  let text = "";
  const output = {
    write(value) {
      text += value;
    },
  };
  return {
    input,
    output,
    get text() {
      return text;
    },
  };
}

test("hidden input supports paste/backspace/Enter, never echoes and removes listeners", async () => {
  const t = terminal();
  const signals = process.listenerCount("SIGINT");
  const result = readTerminalLine("Password: ", true, t.input, t.output);
  t.input.emit("data", Buffer.from("test-secretX\x7f\r"));
  assert.equal(await result, "test-secret");
  assert.equal(t.text, "Password: \n");
  assert.equal(t.input.isRaw, false);
  for (const event of ["data", "end", "close", "error"])
    assert.equal(t.input.listenerCount(event), 0);
  assert.equal(process.listenerCount("SIGINT"), signals);
});

test("Ctrl+C, Ctrl+D, EOF and I/O failure always restore terminal state", async () => {
  for (const event of ["ctrl-c", "ctrl-d", "end", "close", "error"]) {
    const t = terminal();
    const result = readTerminalLine("Password: ", true, t.input, t.output);
    const rejected = assert.rejects(result);
    if (event.startsWith("ctrl"))
      t.input.emit("data", Buffer.from(event === "ctrl-c" ? "\x03" : "\x04"));
    else
      t.input.emit(
        event,
        event === "error" ? new Error("secret must not appear") : undefined,
      );
    await rejected;
    assert.equal(t.input.isRaw, false);
    assert.equal(t.input.listenerCount("data"), 0);
    const next = readTerminalLine("Retry: ", true, t.input, t.output);
    t.input.emit("data", Buffer.from("another-test-secret\r"));
    assert.equal(await next, "another-test-secret");
    assert.equal(t.text.includes("secret"), false);
  }
});

test("explicit stdin mode is bounded and CLI refuses password arguments or implicit piping", async () => {
  assert.equal(
    await readPasswordStdin(Readable.from(["test-password\n"])),
    "test-password",
  );
  await assert.rejects(readPasswordStdin(Readable.from(["a".repeat(4097)])));
  const cli = require.resolve("../dist/cli/user-create");
  for (const args of [
    ["--username", "operator"],
    ["--password", "test-password"],
    ["--unknown"],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      input: "test-password",
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "postgresql://not-used" },
      timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.equal(
      (result.stdout + result.stderr).includes("test-password"),
      false,
    );
  }
});

test("output failure still restores raw mode and removes input listeners", async () => {
  const t = terminal();
  t.output.write = () => {
    throw new Error("fixture output unavailable");
  };
  await assert.rejects(readTerminalLine("Password: ", true, t.input, t.output));
  assert.equal(t.input.isRaw, false);
  assert.equal(t.input.listenerCount("data"), 0);
});
