import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  registerWorkspaceAuthBoundary,
  notifyWorkspaceSessionExpired,
  computeSafeLoginRedirect,
  getCurrentSessionEpoch,
  startNewWorkspaceSession,
  resetWorkspaceAuthState,
} from "../lib/api/workspace-auth.ts";
import { createWorkspaceApiClient } from "../lib/api/workspace-client.ts";
import { createCustomerApi } from "../features/customers/api.ts";
import { createSyncApi } from "../features/carrier-connections/sync-api.ts";
import {
  CustomerApiError,
  customerError,
  customerPowerFailure,
} from "../features/customers/errors.ts";

/**
 * Creates a disposable local HTTP server for testing real openapi-fetch
 * requests through the genuine middleware pipeline.
 */
function createTestServer(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to obtain server address"));
        return;
      }
      const url = `http://127.0.0.1:${address.port}`;
      resolve({
        url,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
            server.closeAllConnections();
          }),
      });
    });
    server.on("error", reject);
  });
}

test("Case 1 — Real 401 UNAUTHORIZED through openapi-fetch triggers boundary redirect and preserves response body", async () => {
  const { url, close } = await createTestServer((req, res) => {
    res.writeHead(401, {
      "Content-Type": "application/json",
      "x-request-id": "test-req-case-1",
    });
    res.end(
      JSON.stringify({
        code: "UNAUTHORIZED",
        message: "Phiên làm việc không hợp lệ hoặc đã hết hạn",
        requestId: "test-req-case-1",
      }),
    );
  });

  try {
    resetWorkspaceAuthState();
    let redirectedTo = null;
    const unregister = registerWorkspaceAuthBoundary(
      () => {
        redirectedTo = computeSafeLoginRedirect("/customers?page=2");
      },
      { userId: "user-test-1" },
    );

    // Consume real client without overriding client.GET
    const client = createWorkspaceApiClient(url);
    const { response, error } = await client.GET("/api/customers");

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("x-request-id"), "test-req-case-1");
    // Verify non-destructive response cloning: error body is fully delivered to caller
    assert.deepEqual(error, {
      code: "UNAUTHORIZED",
      message: "Phiên làm việc không hợp lệ hoặc đã hết hạn",
      requestId: "test-req-case-1",
    });
    assert.equal(redirectedTo, "/login?from=%2Fcustomers%3Fpage%3D2");
    unregister();
  } finally {
    await close();
  }
});

test("Case 2 — Carrier feature API caller handles real 401 UNAUTHORIZED through openapi-fetch pipeline", async () => {
  const { url, close } = await createTestServer((req, res) => {
    res.writeHead(401, {
      "Content-Type": "application/json",
      "x-request-id": "test-req-carrier-sync",
    });
    res.end(
      JSON.stringify({
        code: "UNAUTHORIZED",
        message: "Phiên làm việc đã hết hạn",
        requestId: "test-req-carrier-sync",
      }),
    );
  });

  try {
    resetWorkspaceAuthState();
    let redirectedTo = null;
    const unregister = registerWorkspaceAuthBoundary(
      () => {
        redirectedTo = computeSafeLoginRedirect(
          "/settings/carrier-connections",
        );
      },
      { userId: "user-test-2" },
    );

    const client = createWorkspaceApiClient(url);
    const api = createSyncApi(client);
    const abort = new globalThis.AbortController();

    await assert.rejects(async () => {
      await api.connections(abort.signal);
    });

    assert.equal(redirectedTo, "/login?from=%2Fsettings%2Fcarrier-connections");
    unregister();
  } finally {
    await close();
  }
});

test("Case 3 — Provider auth failure (400 PROVIDER_AUTH_FAILED) through real pipeline does NOT trigger session expiration", async () => {
  const { url, close } = await createTestServer((req, res) => {
    res.writeHead(400, {
      "Content-Type": "application/json",
      "x-request-id": "test-req-provider-auth",
    });
    res.end(
      JSON.stringify({
        code: "PROVIDER_AUTH_FAILED",
        message: "Tài khoản hãng vận chuyển bị từ chối xác thực",
      }),
    );
  });

  try {
    resetWorkspaceAuthState();
    let redirectTriggered = false;
    const unregister = registerWorkspaceAuthBoundary(
      () => {
        redirectTriggered = true;
      },
      { userId: "user-test-3" },
    );

    const client = createWorkspaceApiClient(url);
    const { response, error } = await client.POST(
      "/api/carrier-connections/{id}/reconnect",
      {
        params: { path: { id: "conn-1" } },
        body: { username: "wrong-user", password: "wrong-password" },
      },
    );

    assert.equal(response.status, 400);
    assert.deepEqual(error, {
      code: "PROVIDER_AUTH_FAILED",
      message: "Tài khoản hãng vận chuyển bị từ chối xác thực",
    });
    assert.equal(
      redirectTriggered,
      false,
      "400 PROVIDER_AUTH_FAILED must not trigger session expiration",
    );
    unregister();
  } finally {
    await close();
  }
});

test("Case 4 — Other 401 codes (AUTHENTICATION_FAILED / MFA_VERIFICATION_FAILED) do NOT trigger workspace handler", async () => {
  let requestedCode = "AUTHENTICATION_FAILED";
  const { url, close } = await createTestServer((req, res) => {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        code: requestedCode,
        message: "Xác thực danh tính thất bại",
      }),
    );
  });

  try {
    resetWorkspaceAuthState();
    let redirectTriggered = false;
    const unregister = registerWorkspaceAuthBoundary(
      () => {
        redirectTriggered = true;
      },
      { userId: "user-test-4" },
    );

    const client = createWorkspaceApiClient(url);

    for (const code of ["AUTHENTICATION_FAILED", "MFA_VERIFICATION_FAILED"]) {
      requestedCode = code;
      const { response, error } = await client.GET("/api/customers");
      assert.equal(response.status, 401);
      assert.equal(error?.code, code, `Expected error code ${code}`);
    }

    assert.equal(
      redirectTriggered,
      false,
      "Non-UNAUTHORIZED 401 codes must not trigger workspace expiration",
    );
    unregister();
  } finally {
    await close();
  }
});

test("Case 5 — 403 FORBIDDEN does NOT redirect to Login", async () => {
  const { url, close } = await createTestServer((req, res) => {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        code: "FORBIDDEN",
        message: "Bạn không có quyền thực hiện thao tác này",
      }),
    );
  });

  try {
    resetWorkspaceAuthState();
    let redirectTriggered = false;
    const unregister = registerWorkspaceAuthBoundary(
      () => {
        redirectTriggered = true;
      },
      { userId: "user-test-5" },
    );

    const client = createWorkspaceApiClient(url);
    const { response, error } = await client.GET("/api/customers");

    assert.equal(response.status, 403);
    assert.deepEqual(error, {
      code: "FORBIDDEN",
      message: "Bạn không có quyền thực hiện thao tác này",
    });
    assert.equal(
      redirectTriggered,
      false,
      "403 FORBIDDEN must not redirect to login",
    );
    unregister();
  } finally {
    await close();
  }
});

test("Case 6 — 503 SERVICE_UNAVAILABLE / Server error does NOT redirect to Login", async () => {
  const { url, close } = await createTestServer((req, res) => {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        code: "SERVICE_UNAVAILABLE",
        message: "Hệ thống đang bảo trì",
      }),
    );
  });

  try {
    resetWorkspaceAuthState();
    let redirectTriggered = false;
    const unregister = registerWorkspaceAuthBoundary(
      () => {
        redirectTriggered = true;
      },
      { userId: "user-test-6" },
    );

    const client = createWorkspaceApiClient(url);
    const { response, error } = await client.GET("/api/customers");

    assert.equal(response.status, 503);
    assert.deepEqual(error, {
      code: "SERVICE_UNAVAILABLE",
      message: "Hệ thống đang bảo trì",
    });
    assert.equal(
      redirectTriggered,
      false,
      "503 SERVICE_UNAVAILABLE must not redirect to login",
    );
    unregister();
  } finally {
    await close();
  }
});

test("Case 7 — Malformed or non-JSON 401 error bodies do NOT infer session expiration", async () => {
  let responseMode = "html";
  const { url, close } = await createTestServer((req, res) => {
    if (responseMode === "html") {
      res.writeHead(401, { "Content-Type": "text/html" });
      res.end("<html><head><title>401 Gateway Error</title></head></html>");
    } else if (responseMode === "no-code") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "missing-code-property" }));
    } else {
      res.writeHead(401);
      res.end();
    }
  });

  try {
    resetWorkspaceAuthState();
    let redirectTriggered = false;
    const unregister = registerWorkspaceAuthBoundary(
      () => {
        redirectTriggered = true;
      },
      { userId: "user-test-7" },
    );

    const client = createWorkspaceApiClient(url);

    for (const mode of ["html", "no-code", "empty"]) {
      responseMode = mode;
      const { response } = await client.GET("/api/customers");
      assert.equal(response.status, 401);
    }

    assert.equal(
      redirectTriggered,
      false,
      "Malformed 401 responses must not trigger redirect",
    );
    unregister();
  } finally {
    await close();
  }
});

test("Case 8 — Concurrent 401 requests trigger exactly ONE redirect navigation", async () => {
  const { url, close } = await createTestServer((req, res) => {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        code: "UNAUTHORIZED",
        message: "Phiên làm việc đã hết hạn",
      }),
    );
  });

  try {
    resetWorkspaceAuthState();
    let redirectCount = 0;
    const unregister = registerWorkspaceAuthBoundary(
      () => {
        redirectCount++;
      },
      { userId: "user-test-8" },
    );

    const client = createWorkspaceApiClient(url);

    // Fire 3 simultaneous real network requests
    await Promise.all([
      client.GET("/api/customers"),
      client.GET("/api/customers"),
      client.GET("/api/customers"),
    ]);

    assert.equal(
      redirectCount,
      1,
      "Concurrent 401s must trigger the boundary handler exactly once",
    );
    unregister();
  } finally {
    await close();
  }
});

test("Case 9 — Aborted request cleans up middleware tracking without false notification", async () => {
  const { url, close } = await createTestServer((req, res) => {
    // Delay response to allow client abort
    setTimeout(() => {
      if (!res.writableEnded) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: "UNAUTHORIZED" }));
      }
    }, 200);
  });

  try {
    resetWorkspaceAuthState();
    let redirectCount = 0;
    const unregister = registerWorkspaceAuthBoundary(
      () => {
        redirectCount++;
      },
      { userId: "user-test-9" },
    );

    const client = createWorkspaceApiClient(url);
    const abort = new globalThis.AbortController();

    const promise = client.GET("/api/customers", { signal: abort.signal });
    abort.abort();

    await assert.rejects(async () => {
      await promise;
    });

    assert.equal(redirectCount, 0, "Aborted request must not trigger redirect");
    unregister();
  } finally {
    await close();
  }
});

test("Case 10 — Safe return URL preserves query and rejects open redirects", () => {
  assert.equal(
    computeSafeLoginRedirect("/customers"),
    "/login?from=%2Fcustomers",
  );
  assert.equal(
    computeSafeLoginRedirect("/customers?page=2&status=ACTIVE"),
    "/login?from=%2Fcustomers%3Fpage%3D2%26status%3DACTIVE",
  );
  assert.equal(
    computeSafeLoginRedirect("/settings/carrier-connections"),
    "/login?from=%2Fsettings%2Fcarrier-connections",
  );
  assert.equal(computeSafeLoginRedirect("/"), "/login");
  assert.equal(computeSafeLoginRedirect(""), "/login");

  // Open redirect vectors neutralized
  assert.equal(computeSafeLoginRedirect("https://evil.com"), "/login");
  assert.equal(computeSafeLoginRedirect("//evil.com/path"), "/login");
  assert.equal(computeSafeLoginRedirect("/\\evil.com"), "/login");
  assert.equal(computeSafeLoginRedirect("javascript:alert(1)"), "/login");
});

test("Case 11 — Stale request from prior session cannot disrupt new session; invalid epoch fails closed", () => {
  resetWorkspaceAuthState();
  let session1Redirects = 0;
  const unregister1 = registerWorkspaceAuthBoundary(
    () => {
      session1Redirects++;
    },
    { userId: "user-session-1" },
  );
  const epoch1 = getCurrentSessionEpoch();
  assert.equal(epoch1, 1);
  unregister1();

  // User logs in again -> Session 2
  let session2Redirects = 0;
  const unregister2 = registerWorkspaceAuthBoundary(
    () => {
      session2Redirects++;
    },
    { userId: "user-session-2" },
  );
  const epoch2 = getCurrentSessionEpoch();
  assert.equal(epoch2, 2);

  // Stale request with epoch 1 arrives during session 2
  const staleResult = notifyWorkspaceSessionExpired(epoch1);
  assert.equal(staleResult, false, "Stale epoch must be rejected");
  assert.equal(session1Redirects, 0);
  assert.equal(session2Redirects, 0);

  // Fail-closed checks on invalid/missing epochs
  assert.equal(notifyWorkspaceSessionExpired(undefined), false);
  assert.equal(notifyWorkspaceSessionExpired(0), false);
  assert.equal(notifyWorkspaceSessionExpired(-1), false);
  assert.equal(notifyWorkspaceSessionExpired(Number.NaN), false);
  assert.equal(session2Redirects, 0);

  // Legitimate request with current epoch 2
  const currentResult = notifyWorkspaceSessionExpired(epoch2);
  assert.equal(currentResult, true, "Current epoch 401 must succeed");
  assert.equal(session2Redirects, 1);

  unregister2();
});

test("Case 12 — React Strict Mode remount preserves session epoch, and buffered unmount expiration executes on remount", () => {
  resetWorkspaceAuthState();
  let redirectCount = 0;

  // Mount 1 (Initial effect run)
  const unregister1 = registerWorkspaceAuthBoundary(
    () => {
      redirectCount++;
    },
    { userId: "user-strict-mode" },
  );
  const epochAfterMount1 = getCurrentSessionEpoch();
  assert.equal(epochAfterMount1, 1);

  // Strict Mode Cleanup (effect unmount)
  unregister1();

  // A 401 arrives during the brief unmount gap for the current valid session
  const buffered = notifyWorkspaceSessionExpired(epochAfterMount1);
  assert.equal(
    buffered,
    true,
    "Expiration during unmount gap must be buffered",
  );
  assert.equal(
    redirectCount,
    0,
    "No listener should have run yet while unmounted",
  );

  // Mount 2 (Strict mode remount with SAME user)
  const unregister2 = registerWorkspaceAuthBoundary(
    () => {
      redirectCount++;
    },
    { userId: "user-strict-mode" },
  );

  // Epoch must NOT have been incremented (same session generation)
  assert.equal(
    getCurrentSessionEpoch(),
    1,
    "Same user remount must preserve session epoch",
  );
  // Buffered expiration must be dispatched immediately
  assert.equal(
    redirectCount,
    1,
    "Buffered expiration must run immediately on remount",
  );

  unregister2();
});

test("Case 13 — Explicit session start bumps epoch and resets latch", () => {
  resetWorkspaceAuthState();
  let count = 0;
  const unregister = registerWorkspaceAuthBoundary(() => {
    count++;
  });
  const ep1 = getCurrentSessionEpoch();
  assert.equal(ep1, 1);

  notifyWorkspaceSessionExpired(ep1);
  assert.equal(count, 1);

  // Duplicate 401 is suppressed
  notifyWorkspaceSessionExpired(ep1);
  assert.equal(count, 1);

  // Explicit new session
  const ep2 = startNewWorkspaceSession("user-new");
  assert.equal(ep2, 2);

  // Register listener for new session
  registerWorkspaceAuthBoundary(
    () => {
      count++;
    },
    { userId: "user-new" },
  );

  notifyWorkspaceSessionExpired(ep2);
  assert.equal(count, 2, "New session can receive fresh expiration");
  unregister();
});

test("Case 14 — Customer mutation reconciliation invariants and failure classifications are preserved", () => {
  const err401 = new CustomerApiError(401, { code: "UNAUTHORIZED" });
  const safe401 = customerError(err401);
  assert.equal(safe401.unauthenticated, true);
  assert.equal(safe401.message, "Phiên đăng nhập đã hết hạn.");

  const err404 = new CustomerApiError(404, { code: "NOT_FOUND" });
  assert.equal(customerError(err404).notFound, true);

  const err500 = new CustomerApiError(500, { code: "INTERNAL_ERROR" });
  const fail500 = customerPowerFailure(err500);
  assert.equal(
    fail500.reconcile,
    true,
    "Ambiguous 500 must require reconciliation",
  );

  const err403 = new CustomerApiError(403, { code: "FORBIDDEN" });
  assert.equal(customerPowerFailure(err403).reconcile, true);
});

test("Case 15 — Feature API factories accept real workspace client and operate properly", async () => {
  const { url, close } = await createTestServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        customers: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        stats: null,
      }),
    );
  });

  try {
    const client = createWorkspaceApiClient(url);
    const api = createCustomerApi(client);
    const list = await api.list({ page: 1 });
    assert.deepEqual(list.customers, []);
    assert.equal(list.pagination.page, 1);
  } finally {
    await close();
  }
});
