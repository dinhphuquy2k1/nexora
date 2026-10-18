const test = require("node:test");
const assert = require("node:assert/strict");
test("runtime database is lazy, shares one client, and closes exactly once", async () => {
  const {
    RuntimeDatabase,
  } = require("../dist/common/infrastructure/runtime-database");
  let created = 0,
    closed = 0;
  const client = {
    $disconnect: async () => {
      closed++;
    },
  };
  const db = new RuntimeDatabase("unused", () => {
    created++;
    return client;
  });
  assert.equal(created, 0);
  await db.onApplicationShutdown();
  assert.equal(closed, 0);
  assert.equal(db.client, client);
  assert.equal(db.client, client);
  assert.equal(created, 1);
  await Promise.all([db.onApplicationShutdown(), db.onApplicationShutdown()]);
  assert.equal(closed, 1);
});
