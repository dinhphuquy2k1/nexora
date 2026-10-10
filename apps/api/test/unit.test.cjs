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
