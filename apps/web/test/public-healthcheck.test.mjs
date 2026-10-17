import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { probePublicWebHealth } from "../lib/api/public-healthcheck.mjs";
test("public healthcheck sends actual canonical Host over loopback and fails on rejection/outage", async () => {
  let actualHost, actualPath;
  const server = createServer((req, res) => {
    actualHost = req.headers.host;
    actualPath = req.url;
    res.statusCode = actualHost === "nexora.example.test:443" ? 200 : 400;
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    assert.equal(
      await probePublicWebHealth("nexora.example.test:443", port),
      true,
    );
    assert.equal(actualHost, "nexora.example.test:443");
    assert.equal(actualPath, "/api/health/ready");
    assert.equal(await probePublicWebHealth("evil.example.test", port), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  assert.equal(
    await probePublicWebHealth("nexora.example.test:443", port),
    false,
  );
});
