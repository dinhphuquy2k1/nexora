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

test("external transport denies missing opt-in, missing activation, or unapproved targets with zero fetch and permits approved scoped paths through admission", async (t) => {
  let dispatches = 0;
  let routeHandler = null;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    dispatches++;
    if (!routeHandler) throw Error("Unexpected external fetch");
    return routeHandler(String(url), init);
  });

  // Matrix rows 1-4, 6-8: all non-approved / missing-gate configurations fail closed with zero fetch
  for (const options of [
    {
      apiUrl: "https://kh.uniship.vn",
      liveAuthorized: false,
      activationConfigured: false,
    },
    {
      apiUrl: "https://kh.uniship.vn",
      liveAuthorized: false,
      activationConfigured: true,
    },
    {
      apiUrl: "https://kh.uniship.vn",
      liveAuthorized: true,
      activationConfigured: false,
    },
    {
      apiUrl: "https://kh.uniship.vn",
      liveAuthorized: true,
    },
    {
      apiUrl: "https://other.invalid",
      liveAuthorized: true,
      activationConfigured: true,
    },
    {
      apiUrl: "http://kh.uniship.vn",
      liveAuthorized: true,
      activationConfigured: true,
    },
    {
      apiUrl: "https://synthetic:secret@kh.uniship.vn",
      liveAuthorized: true,
      activationConfigured: true,
    },
    { apiUrl: "http://127.0.0.1:9", isProduction: true },
  ]) {
    const client = new UnishipHttpClient(options);
    assert.equal(client.operationallyAvailable(), false);
    await assert.rejects(
      client.authenticate({
        username: "synthetic",
        password: "synthetic-password",
      }),
      (e) => e.getStatus?.() === 503,
    );
    await assert.rejects(
      client.verify("synthetic-token"),
      (e) => e.getStatus?.() === 503,
    );
    for (const route of ["/client/api/transition/", "/client/api/chinaStores/"])
      await assert.rejects(
        client.getShipment(
          route,
          "synthetic-token",
          new globalThis.AbortController().signal,
        ),
        { code: "SERVICE_UNAVAILABLE" },
      );
  }
  assert.equal(dispatches, 0);

  // Even when operational external flags pass, production/external transport requires boundary admission
  const noAdmissionClient = new UnishipHttpClient({
    apiUrl: "https://kh.uniship.vn",
    liveAuthorized: true,
    activationConfigured: true,
  });
  assert.equal(noAdmissionClient.operationallyAvailable(), true);
  await assert.rejects(
    noAdmissionClient.authenticate({
      username: "synthetic",
      password: "synthetic-password",
    }),
    { code: "SERVICE_UNAVAILABLE" },
  );
  assert.equal(dispatches, 0);

  // Approved external case: intercept all 4 allowed routes through injected boundary admission
  const admittedContexts = [];
  const admissionDouble = {
    run(context, signal, operation) {
      admittedContexts.push(context);
      return operation(signal ?? new globalThis.AbortController().signal);
    },
  };
  const approvedClient = new UnishipHttpClient({
    apiUrl: "https://kh.uniship.vn",
    liveAuthorized: true,
    activationConfigured: true,
    admission: admissionDouble,
  });
  assert.equal(approvedClient.operationallyAvailable(), true);

  const observed = [];
  routeHandler = async (url, init) => {
    observed.push({ url, method: init?.method });
    if (
      url === "https://kh.uniship.vn/client/api-token-auth/" &&
      init?.method === "POST"
    ) {
      return new globalThis.Response(
        JSON.stringify({
          token: "synthetic-ext-token",
          user: { userid: "88001" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (
      url === "https://kh.uniship.vn/client/api-token-verify/" &&
      init?.method === "POST"
    ) {
      return new globalThis.Response(
        JSON.stringify({
          token: "synthetic-ext-token",
          user: { userid: 88001 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (
      url.startsWith("https://kh.uniship.vn/client/api/transition/") &&
      init?.method === "GET"
    ) {
      return new globalThis.Response(
        JSON.stringify({ status: 200, data: [] }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }
    if (
      url.startsWith("https://kh.uniship.vn/client/api/chinaStores/") &&
      init?.method === "GET"
    ) {
      return new globalThis.Response(
        JSON.stringify({ status: 200, data: [] }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }
    throw Error(`Unexpected route ${init?.method} ${url}`);
  };

  const ctx = {
    ownerUserId: "00000000-0000-4000-8000-000000000001",
    connectionId: null,
  };
  const auth = await approvedClient.authenticate(
    { username: "synthetic", password: "synthetic-password" },
    undefined,
    ctx,
  );
  assert.deepEqual(auth, {
    externalAccountId: "88001",
    candidateToken: "synthetic-ext-token",
  });
  const verified = await approvedClient.verify(
    "synthetic-ext-token",
    undefined,
    ctx,
  );
  assert.equal(verified.externalAccountId, "88001");
  const transition = await approvedClient.getShipment(
    "/client/api/transition/",
    "synthetic-ext-token",
    new globalThis.AbortController().signal,
    undefined,
    ctx,
  );
  assert.equal(JSON.parse(transition).status, 200);
  const stores = await approvedClient.getShipment(
    "/client/api/chinaStores/",
    "synthetic-ext-token",
    new globalThis.AbortController().signal,
    undefined,
    ctx,
  );
  assert.equal(JSON.parse(stores).status, 200);
  assert.equal(admittedContexts.length, 4);
  assert.equal(observed.length, 4);
  assert.equal(dispatches, 4);
});
