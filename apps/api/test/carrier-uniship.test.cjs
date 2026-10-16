const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const {
  UnishipHttpClient,
} = require("../dist/carrier/infrastructure/uniship/uniship-http.client");

function createMockProviderServer(handler) {
  const server = http.createServer((req, res) => {
    handler(req, res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const url = `http://127.0.0.1:${port}`;
      resolve({
        url,
        close: () => new Promise((cb) => server.close(cb)),
      });
    });
  });
}

test("UnishipHttpClient enforces URL configuration, HTTPS in production, and blocks unapproved live origins", async () => {
  // 1. Missing apiUrl fails closed
  const unconfigured = new UnishipHttpClient({});
  await assert.rejects(
    unconfigured.authenticate({ username: "nam", password: "pwd" }),
    (err) =>
      err.getStatus?.() === 503 &&
      err.getResponse?.().code === "SERVICE_UNAVAILABLE",
  );

  // 2. Production requires HTTPS
  const insecureProd = new UnishipHttpClient({
    apiUrl: "http://127.0.0.1:8080",
    isProduction: true,
  });
  await assert.rejects(
    insecureProd.authenticate({ username: "nam", password: "pwd" }),
    (err) => err.getStatus?.() === 503,
  );

  // 3. External unapproved origin is blocked without live authorization
  const liveBlocked = new UnishipHttpClient({
    apiUrl: "https://kh.uniship.vn",
    liveAuthorized: false,
    isProduction: false,
  });
  await assert.rejects(
    liveBlocked.authenticate({ username: "nam", password: "pwd" }),
    (err) =>
      err.getStatus?.() === 503 &&
      err.getResponse?.().message ===
        "Dịch vụ xác thực trực tiếp chưa được cấp phép vận hành.",
  );
});

test("UnishipHttpClient handles mock HTTP provider contracts, errors, timeouts, and redirects", async () => {
  let mode = "success-number";
  const mockServer = await createMockProviderServer((req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/client/api-token-auth/");

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const json = JSON.parse(body);
      assert.ok(json.username);
      assert.ok(json.password);

      if (mode === "success-number") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            token: "synthetic-token-num",
            user: {
              email: "",
              username: "test_operator",
              userid: 10482,
              is_verified: true,
            },
          }),
        );
      } else if (mode === "success-string") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            token: "synthetic-token-str",
            user: {
              email: "",
              username: "test_operator",
              userid: "10482",
              is_verified: true,
            },
          }),
        );
      } else if (mode === "root-userid-only") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            token: "synthetic-token-legacy",
            userid: 10482,
          }),
        );
      } else if (mode === "missing-user") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            token: "synthetic-token-nouser",
          }),
        );
      } else if (mode === "missing-nested-userid") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            token: "synthetic-token-nouserid",
            user: {
              email: "",
              username: "test_operator",
              is_verified: true,
            },
          }),
        );
      } else if (mode === "null-nested-userid") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            token: "synthetic-token-nulluserid",
            user: {
              email: "",
              username: "test_operator",
              userid: null,
              is_verified: true,
            },
          }),
        );
      } else if (mode === "empty-userid") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            token: "synthetic-token-emptyuserid",
            user: {
              email: "",
              username: "test_operator",
              userid: "   ",
              is_verified: true,
            },
          }),
        );
      } else if (mode === "invalid-userid-type") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            token: "synthetic-token-arrayuserid",
            user: {
              email: "",
              username: "test_operator",
              userid: [10482],
              is_verified: true,
            },
          }),
        );
      } else if (mode === "float-userid") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            token: "synthetic-token-floatuserid",
            user: {
              email: "",
              username: "test_operator",
              userid: 10482.5,
              is_verified: true,
            },
          }),
        );
      } else if (mode === "missing-token") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            user: {
              email: "",
              username: "test_operator",
              userid: 10482,
              is_verified: true,
            },
          }),
        );
      } else if (mode === "empty-token") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            token: "  ",
            user: {
              email: "",
              username: "test_operator",
              userid: 10482,
              is_verified: true,
            },
          }),
        );
      } else if (mode === "missing-username") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            token: "synthetic-token-nousername",
            user: {
              email: "",
              userid: 10482,
              is_verified: true,
            },
          }),
        );
      } else if (mode === "empty-username") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            token: "synthetic-token-emptyusername",
            user: {
              email: "",
              username: "   ",
              userid: 10482,
              is_verified: true,
            },
          }),
        );
      } else if (mode === "unverified-false") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            token: "synthetic-token-unverified",
            user: {
              email: "",
              username: "test_operator",
              userid: 10482,
              is_verified: false,
            },
          }),
        );
      } else if (mode === "invalid-creds") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            non_field_errors: ["Unable to log in with provided credentials."],
          }),
        );
      } else if (mode === "unauthorized-401") {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ detail: "Unauthorized" }));
      } else if (mode === "server-500") {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal provider crash" }));
      } else if (mode === "malformed-json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("NOT_JSON_BODY");
      } else if (mode === "redirect") {
        res.writeHead(302, { Location: "http://127.0.0.1:9999/other" });
        res.end();
      } else if (mode === "timeout") {
        // Do not respond; wait for adapter timeout
      }
    });
  });

  const loggedOutput = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (...args) => {
    loggedOutput.push(args.join(" "));
  };
  console.error = (...args) => {
    loggedOutput.push(args.join(" "));
  };

  try {
    const adapter = new UnishipHttpClient({
      apiUrl: mockServer.url,
      timeoutMs: 300,
    });

    // 1. Success with nested numeric userid
    mode = "success-number";
    const result1 = await adapter.authenticate({
      username: "op_nam",
      password: "password123",
    });
    assert.deepEqual(result1, {
      externalAccountId: "10482",
      candidateToken: "synthetic-token-num",
    });

    // 2. Success with nested decimal string userid
    mode = "success-string";
    const result2 = await adapter.authenticate({
      username: "op_nam",
      password: "password123",
    });
    assert.deepEqual(result2, {
      externalAccountId: "10482",
      candidateToken: "synthetic-token-str",
    });

    // 3. Root-level-only userid rejected under new contract -> 503 SERVICE_UNAVAILABLE
    mode = "root-userid-only";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "pwd" }),
      (err) =>
        err.getStatus?.() === 503 &&
        err.getResponse?.().code === "SERVICE_UNAVAILABLE",
    );

    // 4. Missing user object -> 503 SERVICE_UNAVAILABLE
    mode = "missing-user";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "pwd" }),
      (err) =>
        err.getStatus?.() === 503 &&
        err.getResponse?.().code === "SERVICE_UNAVAILABLE",
    );

    // 5. Missing nested userid -> 503 SERVICE_UNAVAILABLE
    mode = "missing-nested-userid";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "pwd" }),
      (err) =>
        err.getStatus?.() === 503 &&
        err.getResponse?.().code === "SERVICE_UNAVAILABLE",
    );

    // 6. Null nested userid -> 503 SERVICE_UNAVAILABLE
    mode = "null-nested-userid";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "pwd" }),
      (err) =>
        err.getStatus?.() === 503 &&
        err.getResponse?.().code === "SERVICE_UNAVAILABLE",
    );

    // 7. Empty userid -> 503 SERVICE_UNAVAILABLE
    mode = "empty-userid";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "pwd" }),
      (err) =>
        err.getStatus?.() === 503 &&
        err.getResponse?.().code === "SERVICE_UNAVAILABLE",
    );

    // 8. Invalid userid type (array) -> 503 SERVICE_UNAVAILABLE
    mode = "invalid-userid-type";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "pwd" }),
      (err) =>
        err.getStatus?.() === 503 &&
        err.getResponse?.().code === "SERVICE_UNAVAILABLE",
    );

    // 9. Float userid -> 503 SERVICE_UNAVAILABLE
    mode = "float-userid";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "pwd" }),
      (err) =>
        err.getStatus?.() === 503 &&
        err.getResponse?.().code === "SERVICE_UNAVAILABLE",
    );

    // 10. Missing token -> 503 SERVICE_UNAVAILABLE
    mode = "missing-token";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "pwd" }),
      (err) =>
        err.getStatus?.() === 503 &&
        err.getResponse?.().code === "SERVICE_UNAVAILABLE",
    );

    // 11. Empty token -> 503 SERVICE_UNAVAILABLE
    mode = "empty-token";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "pwd" }),
      (err) =>
        err.getStatus?.() === 503 &&
        err.getResponse?.().code === "SERVICE_UNAVAILABLE",
    );

    // Owner amendment: these fields have no acceptance/identity role.
    for (const accepted of [
      "missing-username",
      "empty-username",
      "unverified-false",
    ]) {
      mode = accepted;
      assert.equal(
        (await adapter.authenticate({ username: "op_nam", password: "pwd" }))
          .externalAccountId,
        "10482",
      );
    }

    // 15. 400 invalid credentials -> 401 AUTHENTICATION_FAILED
    mode = "invalid-creds";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "wrong" }),
      (err) =>
        err.getStatus?.() === 401 &&
        err.getResponse?.().code === "AUTHENTICATION_FAILED",
    );

    // 16. 401 status -> 401 AUTHENTICATION_FAILED
    mode = "unauthorized-401";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "wrong" }),
      (err) =>
        err.getStatus?.() === 401 &&
        err.getResponse?.().code === "AUTHENTICATION_FAILED",
    );

    // 17. 500 server error -> 503 SERVICE_UNAVAILABLE
    mode = "server-500";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "pwd" }),
      (err) =>
        err.getStatus?.() === 503 &&
        err.getResponse?.().code === "SERVICE_UNAVAILABLE",
    );

    // 18. Malformed JSON -> 503 SERVICE_UNAVAILABLE
    mode = "malformed-json";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "pwd" }),
      (err) =>
        err.getStatus?.() === 503 &&
        err.getResponse?.().code === "SERVICE_UNAVAILABLE",
    );

    // 19. Redirect rejection -> 503 SERVICE_UNAVAILABLE
    mode = "redirect";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "pwd" }),
      (err) =>
        err.getStatus?.() === 503 &&
        err.getResponse?.().code === "SERVICE_UNAVAILABLE",
    );

    // 20. Timeout -> 503 SERVICE_UNAVAILABLE
    mode = "timeout";
    await assert.rejects(
      adapter.authenticate({ username: "op_nam", password: "pwd" }),
      (err) =>
        err.getStatus?.() === 503 &&
        err.getResponse?.().code === "SERVICE_UNAVAILABLE",
    );

    // 21. No sensitive token or credential is logged in console output
    const allLogs = loggedOutput.join("\n");
    assert.equal(allLogs.includes("synthetic-token"), false);
    assert.equal(allLogs.includes("password123"), false);
  } finally {
    console.log = origLog;
    console.error = origError;
    await mockServer.close();
  }
});
