require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module");
const { configure } = require("../dist/http");
const {
  DatabaseAdapter,
} = require("../dist/health/infrastructure/database.adapter");
const {
  LocalStorage,
} = require("../dist/storage/infrastructure/local-storage");
const {
  FilesService,
} = require("../dist/storage/application/file-storage.port");
test("migrated PostgreSQL, original file catalog and HTTP errors", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL required");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexora-integration-"));
  process.env.STORAGE_ROOT = root;
  const db = new DatabaseAdapter(process.env.DATABASE_URL);
  let app;
  let blob;
  try {
    assert.equal(await db.isReady(), true);
    const files = new FilesService(new LocalStorage(root), db);
    blob = await files.save(Buffer.from("source workbook bytes"));
    assert.equal(
      (await files.read(blob.id)).toString(),
      "source workbook bytes",
    );
    assert.equal(
      (await db.client.storedFile.findUniqueOrThrow({ where: { id: blob.id } }))
        .sha256,
      blob.sha256,
    );
    app = await NestFactory.create(AppModule, { logger: false });
    configure(app);
    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();
    let res = await fetch(url + "/api/health/ready");
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).checks, {
      database: true,
      storage: true,
    });
    res = await fetch(url + "/api/nonexistent?api_key=never-log-this", {
      headers: {
        authorization: "Bearer never-log-this",
        cookie: "secret=never-log-this",
      },
    });
    assert.equal(res.status, 404);
    const error = await res.json();
    assert.equal(error.code, "NOT_FOUND");
    assert.equal(error.requestId, res.headers.get("x-request-id"));
    assert.ok(!JSON.stringify(error).includes("never-log-this"));
    const offline = new DatabaseAdapter(
      "postgresql://u:p@127.0.0.1:1/db?connect_timeout=1",
    );
    assert.equal(await offline.isReady(), false);
    await offline.onApplicationShutdown();
  } finally {
    if (app) await app.close();
    if (blob) await db.client.storedFile.delete({ where: { id: blob.id } });
    await db.onApplicationShutdown();
    await fs.rm(root, { recursive: true, force: true });
  }
});
