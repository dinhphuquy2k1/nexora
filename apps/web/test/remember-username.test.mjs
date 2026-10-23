import test from "node:test";
import assert from "node:assert/strict";
test("Remember Me persists only a bounded username, restores it and removes unchecked preference", async () => {
  const {
    readRememberedUsername,
    writeRememberedUsername,
    REMEMBERED_USERNAME_KEY,
  } = await import("../lib/auth/remember-username.ts");
  const values = new Map();
  const storage = () => ({
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  });
  assert.equal(readRememberedUsername(storage), "");
  writeRememberedUsername(storage, " operator ", true);
  assert.deepEqual([...values], [[REMEMBERED_USERNAME_KEY, "operator"]]);
  assert.equal(readRememberedUsername(storage), "operator");
  writeRememberedUsername(storage, "operator", false);
  assert.equal(values.size, 0);
  for (const value of ["", "x".repeat(51)]) {
    writeRememberedUsername(storage, value, true);
    assert.equal(values.size, 0);
  }
});
test("denied storage getters or methods never break authentication UX", async () => {
  const { readRememberedUsername, writeRememberedUsername } = await import(
    "../lib/auth/remember-username.ts"
  );
  const denied = () => {
    throw Error("storage denied");
  };
  assert.equal(readRememberedUsername(denied), "");
  assert.doesNotThrow(() => writeRememberedUsername(denied, "operator", true));
  const storage = () => ({
    getItem: denied,
    setItem: denied,
    removeItem: denied,
  });
  assert.equal(readRememberedUsername(storage), "");
  assert.doesNotThrow(() =>
    writeRememberedUsername(storage, "operator", false),
  );
});
