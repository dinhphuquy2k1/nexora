import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedHost } from "../lib/auth/host.ts";
const env = {
  NEXORA_DEPLOYMENT_PROFILE: "PUBLIC_HTTPS",
  PUBLIC_ORIGIN: "https://nexora.example.test",
  ALLOWED_HOSTS: "nexora.example.test",
  ALLOWED_ORIGINS: "https://nexora.example.test",
};
test("public Host policy exact authorities and strict parsing, local compatibility", () => {
  for (const host of [
    "nexora.example.test",
    "NEXORA.EXAMPLE.TEST",
    "nexora.example.test:443",
  ])
    assert.equal(isAllowedHost(host, env), true);
  for (const host of [
    null,
    "",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "nexora.example.test:444",
    "nexora.example.test:65536",
    "nexora.example.test:0",
    "nexora.example.test:banana",
    "nexora.example.test/path",
    "user@nexora.example.test",
    "nexora.example.test?x",
    "nexora.example.test#x",
    "nexora.example.test.evil",
    "nexora.example.test.",
    "[::1]:443",
    "::1",
    "[:::1]",
    "nexora.example.test\r\nx: y",
    "nexora.example.test,evil.test",
    "0177.0.0.1",
  ])
    assert.equal(isAllowedHost(host, env), false);
  assert.equal(isAllowedHost("localhost:3001", {}), true);
  assert.equal(isAllowedHost("0.0.0.0:3000", {}), true);
  assert.equal(
    isAllowedHost("nexora.example.test", { ...env, ALLOWED_ORIGINS: "" }),
    false,
  );
});
