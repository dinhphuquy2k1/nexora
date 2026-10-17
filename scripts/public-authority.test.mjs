import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
function policy(origin, fqdn = "nexora.example.test") {
  return spawnSync(
    "sh",
    [
      "-c",
      '. ./docker/public/public-authority.sh && configure_public_authority && printf "%s\\n%s\\n%s\\n%s" "$PUBLIC_FQDN" "$PUBLIC_ORIGIN" "$PUBLIC_AUTHORITY" "$PUBLIC_AUTHORITY_ALT_DIRECTIVE"',
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PUBLIC_FQDN: fqdn, PUBLIC_ORIGIN: origin },
    },
  );
}
test("actual ingress authority policy normalizes default TLS port and case, preserving explicit alternate ports", () => {
  for (const origin of [
    "https://nexora.example.test",
    "https://nexora.example.test:443",
    "HTTPS://NEXORA.EXAMPLE.TEST:443",
  ]) {
    const result = policy(origin, "NEXORA.EXAMPLE.TEST");
    assert.equal(result.status, 0);
    assert.equal(
      result.stdout,
      'nexora.example.test\nhttps://nexora.example.test\nnexora.example.test\n"nexora.example.test:443" 1;',
    );
  }
  const custom = policy("https://nexora.example.test:8443");
  assert.equal(custom.status, 0);
  assert.equal(
    custom.stdout,
    "nexora.example.test\nhttps://nexora.example.test:8443\nnexora.example.test:8443\n",
  );
});
test("ingress authority policy rejects mismatched and malformed origins and ports", () => {
  for (const origin of [
    "http://nexora.example.test",
    "https://evil.example.test",
    "https://nexora.example.test/",
    "https://nexora.example.test:0",
    "https://nexora.example.test:0443",
    "https://nexora.example.test:65536",
    "https://nexora.example.test:443:8443",
    "https://nexora.example.test:443;evil",
  ]) {
    assert.notEqual(policy(origin).status, 0);
  }
  assert.notEqual(
    policy("https://nexora.example.test", "nexora.example.test/path").status,
    0,
  );
});
