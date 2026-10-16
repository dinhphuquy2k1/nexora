const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const {
  UnishipHttpClient,
  parseProviderIdentity,
} = require("../dist/carrier/infrastructure/uniship/uniship-http.client");

test("owner amendment ignores is_verified and username; userid remains authoritative", () => {
  for (const is_verified of [true, false, undefined, "wrong-type", null]) {
    assert.equal(
      parseProviderIdentity({
        token: "synthetic",
        user: { userid: " 12345 ", is_verified },
      }).externalAccountId,
      "12345",
    );
  }
  for (const userid of [
    0,
    -1,
    1.1,
    Number.MAX_SAFE_INTEGER + 1,
    "01",
    "0",
    "1.0",
    "1".repeat(129),
    null,
    [],
  ]) {
    assert.throws(() =>
      parseProviderIdentity({ token: "synthetic", user: { userid } }),
    );
  }
});

test("verify uses observed contract, matches candidate safely and bounds failures", async () => {
  let mode = "ok";
  let calls = 0;
  const server = http.createServer(async (req, res) => {
    calls++;
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/client/api-token-verify/");
    assert.equal(req.headers.authorization, "Bearer synthetic-candidate");
    assert.equal(req.headers.accept, "application/json");
    let body = "";
    for await (const chunk of req) body += chunk;
    assert.deepEqual(JSON.parse(body), {
      token: "synthetic-candidate",
      FirebaseToken: null,
    });
    if (mode === "429") {
      res.writeHead(429, { "Retry-After": "2" });
      return res.end();
    }
    if (mode === "401" || mode === "500") {
      res.writeHead(Number(mode));
      return res.end();
    }
    if (mode === "redirect") {
      res.writeHead(302, { Location: "/other" });
      return res.end();
    }
    if (mode === "timeout") return;
    if (mode === "oversize") return res.end("x".repeat(70000));
    if (mode === "invalid") return res.end("not-json");
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        token: mode === "replacement" ? "different" : "synthetic-candidate",
        user: { userid: 12345, is_verified: false },
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const client = new UnishipHttpClient({
    apiUrl: `http://127.0.0.1:${server.address().port}`,
    timeoutMs: 100,
  });
  try {
    assert.equal(
      (await client.verify("synthetic-candidate")).externalAccountId,
      "12345",
    );
    for (const [next, status] of [
      ["replacement", 401],
      ["429", 429],
      ["401", 401],
      ["500", 503],
      ["oversize", 503],
      ["invalid", 503],
      ["redirect", 503],
      ["timeout", 503],
    ]) {
      mode = next;
      await assert.rejects(
        client.verify("synthetic-candidate"),
        (e) => e.getStatus?.() === status,
      );
    }
    const before = calls;
    await assert.rejects(client.verify("bad\r\nheader"));
    assert.equal(calls, before);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("external live remains closed even with runtime opt-in until official authorization", async () => {
  const originalFetch = globalThis.fetch;
  let attempted = 0;
  globalThis.fetch = async () => {
    attempted++;
    throw Error("External network forbidden in tests");
  };
  try {
    for (const apiUrl of [
      "https://provider.invalid",
      "https://user:secret@provider.invalid",
      "https://provider.invalid/?token=synthetic",
      "file:///synthetic",
    ]) {
      const client = new UnishipHttpClient({ apiUrl, liveAuthorized: true });
      await assert.rejects(
        client.authenticate({ username: "synthetic", password: "synthetic" }),
        (e) => e.getStatus?.() === 503,
      );
    }
    assert.equal(attempted, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
