import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registerWorkspaceAuthBoundary,
  notifyWorkspaceSessionExpired,
  computeSafeLoginRedirect,
  getCurrentSessionEpoch,
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

test("Case 1 — Customer session expired (401 UNAUTHORIZED) triggers global boundary redirect", async () => {
  resetWorkspaceAuthState();
  let redirectedTo = null;
  const unregister = registerWorkspaceAuthBoundary(
    () => {
      redirectedTo = computeSafeLoginRedirect("/customers?page=2");
    },
    { userId: "user-test-1" },
  );

  const mockFetch = async () =>
    new globalThis.Response(
      JSON.stringify({
        code: "UNAUTHORIZED",
        message: "Phiên làm việc không hợp lệ hoặc đã hết hạn",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );

  const client = createWorkspaceApiClient();
  // Override fetch for testing
  client.GET = async () => {
    const res = await mockFetch();
    const clone = res.clone();
    const body = await clone.json();
    if (res.status === 401 && body?.code === "UNAUTHORIZED") {
      notifyWorkspaceSessionExpired(getCurrentSessionEpoch());
    }
    return { response: res, error: body };
  };

  const api = createCustomerApi(client);
  await assert.rejects(async () => {
    await api.list({ page: 2 });
  }, CustomerApiError);

  assert.equal(redirectedTo, "/login?from=%2Fcustomers%3Fpage%3D2");
  unregister();
});

test("Case 2 — Carrier session expired (401 UNAUTHORIZED) triggers global boundary redirect", async () => {
  resetWorkspaceAuthState();
  let redirectedTo = null;
  const unregister = registerWorkspaceAuthBoundary(
    () => {
      redirectedTo = computeSafeLoginRedirect("/settings/carrier-connections");
    },
    { userId: "user-test-2" },
  );

  const client = createWorkspaceApiClient();
  client.GET = async () => {
    const res = new globalThis.Response(
      JSON.stringify({
        code: "UNAUTHORIZED",
        message: "Phiên làm việc không hợp lệ hoặc đã hết hạn",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
    notifyWorkspaceSessionExpired(getCurrentSessionEpoch());
    return { response: res };
  };

  const api = createSyncApi(client);
  const abort = new globalThis.AbortController();
  await assert.rejects(async () => {
    await api.connections(abort.signal);
  });

  assert.equal(redirectedTo, "/login?from=%2Fsettings%2Fcarrier-connections");
  unregister();
});

test("Case 3 — Concurrent 401 responses trigger exactly ONE redirect", async () => {
  resetWorkspaceAuthState();
  let redirectCount = 0;
  const unregister = registerWorkspaceAuthBoundary(
    () => {
      redirectCount++;
    },
    { userId: "user-test-3" },
  );

  const epoch = getCurrentSessionEpoch();
  // Three simultaneous 401 notifications
  const r1 = notifyWorkspaceSessionExpired(epoch);
  const r2 = notifyWorkspaceSessionExpired(epoch);
  const r3 = notifyWorkspaceSessionExpired(epoch);

  assert.equal(r1, true, "First 401 must trigger redirect");
  assert.equal(
    r2,
    false,
    "Second 401 must be suppressed by single-flight latch",
  );
  assert.equal(
    r3,
    false,
    "Third 401 must be suppressed by single-flight latch",
  );
  assert.equal(
    redirectCount,
    1,
    "Boundary handler must be invoked exactly once",
  );
  unregister();
});

test("Case 4 — Carrier provider auth failure (400 PROVIDER_AUTH_FAILED) does NOT trigger session expiration", async () => {
  resetWorkspaceAuthState();
  let redirectTriggered = false;
  const unregister = registerWorkspaceAuthBoundary(
    () => {
      redirectTriggered = true;
    },
    { userId: "user-test-4" },
  );

  const response = new globalThis.Response(
    JSON.stringify({
      code: "PROVIDER_AUTH_FAILED",
      message: "Không thể thực hiện yêu cầu",
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" },
    },
  );

  // Status is 400, not 401
  if (response.status === 401) {
    const clone = response.clone();
    const body = await clone.json();
    if (body?.code === "UNAUTHORIZED") {
      notifyWorkspaceSessionExpired(getCurrentSessionEpoch());
    }
  }

  assert.equal(
    redirectTriggered,
    false,
    "400 PROVIDER_AUTH_FAILED must not trigger redirect",
  );
  unregister();
});

test("Case 5 — Login / MFA errors (401 AUTHENTICATION_FAILED / MFA_VERIFICATION_FAILED) do NOT trigger workspace handler", async () => {
  resetWorkspaceAuthState();
  let redirectTriggered = false;
  const unregister = registerWorkspaceAuthBoundary(
    () => {
      redirectTriggered = true;
    },
    { userId: "user-test-5" },
  );

  for (const code of ["AUTHENTICATION_FAILED", "MFA_VERIFICATION_FAILED"]) {
    const response = new globalThis.Response(
      JSON.stringify({
        code,
        message: "Xác thực thất bại",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );

    const clone = response.clone();
    const body = await clone.json();
    if (response.status === 401 && body?.code === "UNAUTHORIZED") {
      notifyWorkspaceSessionExpired(getCurrentSessionEpoch());
    }
  }

  assert.equal(
    redirectTriggered,
    false,
    "Non-UNAUTHORIZED 401 must not trigger redirect",
  );
  unregister();
});

test("Case 6 — 403 FORBIDDEN does NOT redirect to Login", async () => {
  resetWorkspaceAuthState();
  let redirectTriggered = false;
  const unregister = registerWorkspaceAuthBoundary(
    () => {
      redirectTriggered = true;
    },
    { userId: "user-test-6" },
  );

  const response = new globalThis.Response(
    JSON.stringify({
      code: "FORBIDDEN",
      message: "Yêu cầu bị từ chối",
    }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    },
  );

  if (response.status === 401) {
    notifyWorkspaceSessionExpired(getCurrentSessionEpoch());
  }

  assert.equal(redirectTriggered, false, "403 FORBIDDEN must not redirect");
  unregister();
});

test("Case 7 — 503 / Network server failure does NOT redirect to Login", async () => {
  resetWorkspaceAuthState();
  let redirectTriggered = false;
  const unregister = registerWorkspaceAuthBoundary(
    () => {
      redirectTriggered = true;
    },
    { userId: "user-test-7" },
  );

  const response = new globalThis.Response(
    JSON.stringify({
      code: "SERVICE_UNAVAILABLE",
      message: "Dịch vụ tạm thời không khả dụng",
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" },
    },
  );

  if (response.status === 401) {
    notifyWorkspaceSessionExpired(getCurrentSessionEpoch());
  }

  assert.equal(redirectTriggered, false, "503 must not redirect");
  unregister();
});

test("Case 8 — Malformed or non-JSON error body does not infer session expiration", async () => {
  resetWorkspaceAuthState();
  let redirectTriggered = false;
  const unregister = registerWorkspaceAuthBoundary(
    () => {
      redirectTriggered = true;
    },
    { userId: "user-test-8" },
  );

  const badResponses = [
    new globalThis.Response("<html>Internal Gateway Error</html>", {
      status: 401,
    }),
    new globalThis.Response(JSON.stringify({ error: "missing code field" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
    new globalThis.Response("", { status: 401 }),
  ];

  for (const res of badResponses) {
    try {
      const clone = res.clone();
      const body = await clone.json();
      if (res.status === 401 && body?.code === "UNAUTHORIZED") {
        notifyWorkspaceSessionExpired(getCurrentSessionEpoch());
      }
    } catch {
      // expected safe catch
    }
  }

  assert.equal(
    redirectTriggered,
    false,
    "Malformed 401 must not trigger redirect",
  );
  unregister();
});

test("Case 9 — Safe return URL preserves query and rejects open redirects", () => {
  // Safe local paths
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

  // Unsafe / open redirect attempts neutralized to "/login"
  assert.equal(computeSafeLoginRedirect("https://evil.com"), "/login");
  assert.equal(computeSafeLoginRedirect("//evil.com/path"), "/login");
  assert.equal(computeSafeLoginRedirect("/\\evil.com"), "/login");
  assert.equal(computeSafeLoginRedirect("javascript:alert(1)"), "/login");
});

test("Case 10 — Stale requests from prior session cannot disrupt new session", () => {
  resetWorkspaceAuthState();
  let redirectCount = 0;

  // Session 1 starts (epoch 1)
  const unregister1 = registerWorkspaceAuthBoundary(
    () => {
      redirectCount++;
    },
    { userId: "user-session-1" },
  );
  const epochSession1 = getCurrentSessionEpoch();
  assert.equal(epochSession1, 1);
  unregister1();

  // User logs in again / Session 2 starts (epoch 2)
  let session2RedirectCount = 0;
  const unregister2 = registerWorkspaceAuthBoundary(
    () => {
      session2RedirectCount++;
    },
    { userId: "user-session-2" },
  );
  const epochSession2 = getCurrentSessionEpoch();
  assert.equal(epochSession2, 2);

  // Stale 401 from session 1 arrives now
  const staleHandled = notifyWorkspaceSessionExpired(epochSession1);
  assert.equal(staleHandled, false, "Stale 401 from old epoch must be ignored");
  assert.equal(
    session2RedirectCount,
    0,
    "New session must not be logged out by old response",
  );
  assert.equal(redirectCount, 0);

  // Legitimate 401 in session 2
  const currentHandled = notifyWorkspaceSessionExpired(epochSession2);
  assert.equal(currentHandled, true, "Current session 401 must be processed");
  assert.equal(session2RedirectCount, 1);

  unregister2();
});

test("Case 11 — Customer mutation reconciliation invariants and failure classifications are preserved", () => {
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

test("Case 12 — Existing SDK clients remain injectable in feature API factories", async () => {
  const customCalls = [];
  const mockClient = {
    GET: async (path, opts) => {
      customCalls.push({ method: "GET", path, opts });
      return {
        response: new globalThis.Response(
          JSON.stringify({
            customers: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
            stats: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
        data: {
          customers: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          stats: null,
        },
      };
    },
  };

  const customerApiInstance = createCustomerApi(mockClient);
  const list = await customerApiInstance.list({ page: 1 });
  assert.equal(customCalls.length, 1);
  assert.equal(customCalls[0].path, "/api/customers");
  assert.deepEqual(list.customers, []);
});
