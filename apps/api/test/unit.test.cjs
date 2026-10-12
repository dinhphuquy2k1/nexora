const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const {
  LocalStorage,
} = require("../dist/storage/infrastructure/local-storage");
const {
  FilesService,
} = require("../dist/storage/application/file-storage.port");
const { HealthService } = require("../dist/health/application/health.service");
const { loadConfig } = require("../dist/config");
test("storage roundtrip, permissions, opaque IDs, size limit, traversal and symlink rejection", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexora-storage-"));
  const s = new LocalStorage(root, 32);
  try {
    const blob = await s.put(Buffer.from("original source"));
    assert.equal((await s.read(blob.id)).toString(), "original source");
    if (process.platform !== "win32") {
      assert.equal(
        (await fs.stat(path.join(root, blob.id))).mode & 0o777,
        0o600,
      );
    }
    assert.equal(await s.isReady(), true);
    for (const id of ["../x", "/etc/passwd", "..", "foo"])
      await assert.rejects(s.read(id));
    await assert.rejects(s.put(Buffer.alloc(33)));
    try {
      const symId = randomUUID();
      await fs.symlink("/etc/passwd", path.join(root, symId));
      await assert.rejects(s.read(symId));
      const rootLink = root + "-link";
      await fs.symlink(root, rootLink);
      await assert.rejects(new LocalStorage(rootLink).put(Buffer.from("x")));
      await fs.unlink(rootLink);
    } catch (e) {
      if (e.code !== "EPERM") throw e;
    }
    await s.remove(blob.id);
    await assert.rejects(s.read(blob.id));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("catalog failure removes newly written blob", async () => {
  let removed;
  const blob = { id: randomUUID(), sizeBytes: 1, sha256: "hash" };
  const svc = new FilesService(
    {
      put: async () => blob,
      remove: async (id) => {
        removed = id;
      },
    },
    {
      register: async () => {
        throw Error("DB unavailable");
      },
      has: async () => false,
    },
  );
  await assert.rejects(svc.save(Buffer.from("x")));
  assert.equal(removed, blob.id);
  await assert.rejects(svc.read(blob.id));
});
test("readiness fails closed independently of liveness", async () => {
  const h = new HealthService(
    { isReady: async () => false },
    { isReady: async () => true },
  );
  assert.deepEqual(h.live(), { status: "ok" });
  assert.deepEqual(await h.ready(), {
    status: "unavailable",
    checks: { database: false, storage: true },
  });
});
test("config fail fast without leaking values", () => {
  assert.throws(
    () =>
      loadConfig({ DATABASE_URL: "secret-invalid", STORAGE_ROOT: "relative" }),
    (e) =>
      e.message.includes("DATABASE_URL") &&
      !e.message.includes("secret-invalid"),
  );
  const tmpRoot =
    process.platform === "win32" ? path.resolve(os.tmpdir()) : "/tmp";
  assert.throws(() =>
    loadConfig({
      DATABASE_URL: "http://bad",
      STORAGE_ROOT: tmpRoot,
      API_DOCS_ENABLED: "yes",
    }),
  );
  assert.equal(
    loadConfig({
      DATABASE_URL: "postgresql://u:p@localhost/db",
      STORAGE_ROOT: tmpRoot,
    }).PORT,
    4000,
  );
});

test("Uniship configuration parser normalizes empty URLs, validates protocols, and defaults authorization", () => {
  const tmpRoot =
    process.platform === "win32" ? path.resolve(os.tmpdir()) : "/tmp";
  const base = {
    DATABASE_URL: "postgresql://u:p@localhost/db",
    STORAGE_ROOT: tmpRoot,
  };

  // 1. UNISHIP_API_URL absent -> valid, undefined
  const c1 = loadConfig({ ...base });
  assert.equal(c1.UNISHIP_API_URL, undefined);
  assert.equal(c1.UNISHIP_LIVE_AUTHORIZED, "false");

  // 2. UNISHIP_API_URL="" -> valid, undefined
  const c2 = loadConfig({ ...base, UNISHIP_API_URL: "" });
  assert.equal(c2.UNISHIP_API_URL, undefined);

  // 3. Valid HTTPS URL -> accepted
  const c3 = loadConfig({
    ...base,
    UNISHIP_API_URL: "https://auth.uniship.example.com",
  });
  assert.equal(c3.UNISHIP_API_URL, "https://auth.uniship.example.com");

  // 4. Valid HTTP URL -> accepted
  const c4 = loadConfig({
    ...base,
    UNISHIP_API_URL: "http://127.0.0.1:4000",
  });
  assert.equal(c4.UNISHIP_API_URL, "http://127.0.0.1:4000");

  // 5. Malformed URL -> rejected
  for (const malformed of ["not-a-url", "://missing-scheme", "https://"]) {
    assert.throws(() =>
      loadConfig({
        ...base,
        UNISHIP_API_URL: malformed,
      }),
    );
  }

  // 6. Unsupported protocol -> rejected
  for (const badProtocol of [
    "ftp://example.com",
    "ws://example.com",
    "file:///etc/passwd",
  ]) {
    assert.throws(() =>
      loadConfig({
        ...base,
        UNISHIP_API_URL: badProtocol,
      }),
    );
  }

  // 7. Authorization flag absent -> defaults false
  const c7 = loadConfig({ ...base });
  assert.equal(c7.UNISHIP_LIVE_AUTHORIZED, "false");

  // 8. Authorization flag false -> accepted
  const c8 = loadConfig({ ...base, UNISHIP_LIVE_AUTHORIZED: "false" });
  assert.equal(c8.UNISHIP_LIVE_AUTHORIZED, "false");

  // 9. Authorization flag true -> accepted
  const c9 = loadConfig({ ...base, UNISHIP_LIVE_AUTHORIZED: "true" });
  assert.equal(c9.UNISHIP_LIVE_AUTHORIZED, "true");

  // 10. Authorization flag invalid -> rejected
  for (const invalidFlag of ["yes", "1", "TRUE", "false-ish", "null"]) {
    assert.throws(() =>
      loadConfig({
        ...base,
        UNISHIP_LIVE_AUTHORIZED: invalidFlag,
      }),
    );
  }
});

test("Origin configuration validates serialization, effective ports and supported bindings", () => {
  const {
    resolveAllowedOrigins,
    isAllowedOrigin,
  } = require("../dist/identity/presentation/origin-policy");
  assert.deepEqual(resolveAllowedOrigins({ WEB_PORT: "127.0.0.1:3101" }), [
    "http://127.0.0.1:3101",
    "http://localhost:3101",
  ]);
  assert.deepEqual(resolveAllowedOrigins({ WEB_PORT: "3101" }), [
    "http://127.0.0.1:3101",
    "http://localhost:3101",
  ]);
  const allowed = resolveAllowedOrigins({
    ALLOWED_ORIGINS: "http://localhost:80",
  });
  assert.equal(isAllowedOrigin("http://localhost", allowed), true);
  assert.equal(isAllowedOrigin("http://localhost:80", allowed), true);
  for (const value of ["0", "65536", "0.0.0.0:3101", "127.0.0.1:invalid"])
    assert.throws(() => resolveAllowedOrigins({ WEB_PORT: value }));
  for (const value of [
    "http://localhost:3001/",
    "http://localhost:3001?x=1",
    "http://user@localhost:3001",
    "null",
    "http://localhost:3001,",
  ])
    assert.throws(() => resolveAllowedOrigins({ ALLOWED_ORIGINS: value }));
});

test("Origin defaults treat absent/empty/whitespace configuration consistently", () => {
  const {
    resolveAllowedOrigins,
  } = require("../dist/identity/presentation/origin-policy");
  const expected = ["http://127.0.0.1:3101", "http://localhost:3101"];
  for (const ALLOWED_ORIGINS of [undefined, "", "   "])
    for (const WEB_PORT of ["3101", "127.0.0.1:3101", "localhost:3101"])
      assert.deepEqual(
        resolveAllowedOrigins({ ALLOWED_ORIGINS, WEB_PORT }),
        expected,
      );
});
