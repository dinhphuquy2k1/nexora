// Requires genuine generated Prisma client and migrated PostgreSQL; no mocked auth/DB.
require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { mkdtemp, rm, readFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { createDatabase, hashPassword } = require("@nexora/database");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module");
const { configure } = require("../dist/http");
const { loadConfig } = require("../dist/config");
const {
  CustomerAdapter,
} = require("../dist/customer/infrastructure/customer.adapter");
const {
  IdentityDatabaseAdapter,
} = require("../dist/identity/infrastructure/identity.adapter");
const { loginWithMfa } = require("./helpers/mfa-fixture.cjs");
test(
  "Customer real Nest/PostgreSQL owner security, transactions, concurrency and runtime authority",
  { timeout: 180000 },
  async () => {
    assert.ok(process.env.DATABASE_URL);
    const saved = { ...process.env },
      admin = createDatabase(process.env.DATABASE_URL),
      name = "nexora_customer_" + randomUUID().replaceAll("-", "");
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/" + name;
    const root = await mkdtemp(join(tmpdir(), "nexora-customer-"));
    let db,
      store,
      identity,
      app,
      owned = false;
    const log = console.log,
      logs = [];
    console.log = (...args) => logs.push(args.join(" "));
    try {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      owned = true;
      execFileSync(
        process.execPath,
        [
          resolve("../../packages/database/node_modules/prisma/build/cli.js"),
          "migrate",
          "deploy",
          "--config",
          resolve("../../packages/database/prisma.config.ts"),
        ],
        {
          env: { ...process.env, DATABASE_URL: url.toString() },
          stdio: "pipe",
          timeout: 60000,
        },
      );
      db = createDatabase(url.toString());
      const { provisionRuntime, runtimeUrl } = await import(
        "../../../packages/database/scripts/provision-runtime.mjs"
      );
      const runtimePassword = (
        await readFile("/runtime-config/postgres_app_password", "utf8")
      ).trim();
      await provisionRuntime(url.toString(), runtimePassword);
      const { assertRuntimePrivileges } = await import(
        "../../../packages/database/test/runtime-privilege-assertions.mjs"
      );
      await assertRuntimePrivileges(url.toString(), runtimePassword);
      const appUrl = runtimeUrl(url.toString(), runtimePassword);
      store = new CustomerAdapter(appUrl);
      identity = new IdentityDatabaseAdapter(appUrl);
      const hash = await hashPassword("CustomerTestPass123!");
      const users = [];
      for (const role of ["OPERATOR", "OPERATOR", "ADMIN"])
        users.push(
          await db.user.create({
            data: {
              username: "customer-" + randomUUID(),
              role,
              status: "ACTIVE",
              credential: { create: { passwordHash: hash } },
            },
          }),
        );
      const tokens = [];
      for (const user of users)
        tokens.push(
          (await loginWithMfa(identity, user.username, "CustomerTestPass123!"))
            .token,
        );
      process.env.DATABASE_URL = appUrl;
      process.env.STORAGE_ROOT = root;
      app = await NestFactory.create(AppModule, {
        logger: false,
        abortOnError: false,
      });
      configure(app);
      await app.listen(0, "127.0.0.1");
      const base = await app.getUrl(),
        origin = loadConfig(process.env).trustedOrigins[0];
      async function request(
        path,
        method = "GET",
        body,
        token = tokens[0],
        requestOrigin = origin,
      ) {
        const response = await fetch(base + "/api/customers" + path, {
          method,
          headers: {
            ...(token ? { cookie: "nexora_session=" + token } : {}),
            ...(requestOrigin ? { origin: requestOrigin } : {}),
            "content-type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const result = await response.json();
        if (response.status >= 400) {
          assert.deepEqual(Object.keys(result).sort(), [
            "code",
            "message",
            "requestId",
          ]);
          assert.equal(result.requestId, response.headers.get("x-request-id"));
        }
        return { status: response.status, body: result };
      }
      const error = (r, status, code) => {
        assert.equal(r.status, status);
        assert.equal(r.body.code, code);
      };
      error(await request("", "GET", undefined, null), 401, "UNAUTHORIZED");
      const create = await request("", "POST", {
        name: "PII-Customer-Secret",
        phone: "0912345678",
        email: "pii@example.test",
        note: "PII-NOTE",
        address: { addressText: "PII-ADDRESS" },
      });
      assert.equal(create.status, 201);
      const customer = create.body.customer,
        id = customer.id,
        first = customer.addresses[0];
      assert.match(customer.code, /^KH[0-9]{6,}$/);
      assert.equal(customer.phone, "+84912345678");
      assert.equal(first.recipientName, customer.name);
      assert.equal(first.recipientPhone, customer.phone);
      assert.equal(first.isDefault, true);
      assert.deepEqual(
        Object.keys(customer).sort(),
        [
          "id",
          "code",
          "name",
          "phone",
          "email",
          "note",
          "status",
          "createdAt",
          "updatedAt",
          "addresses",
        ].sort(),
      );
      for (const token of [tokens[1], tokens[2]]) {
        error(
          await request("/" + id, "GET", undefined, token),
          404,
          "NOT_FOUND",
        );
        error(
          await request("/" + id, "PATCH", { name: "foreign" }, token),
          404,
          "NOT_FOUND",
        );
        error(
          await request(
            "/" + id + "/addresses",
            "POST",
            { addressText: "foreign" },
            token,
          ),
          404,
          "NOT_FOUND",
        );
        error(
          await request(
            "/" + id + "/addresses/" + first.id,
            "PATCH",
            { label: "foreign" },
            token,
          ),
          404,
          "NOT_FOUND",
        );
        error(
          await request(
            "/" + id + "/addresses/" + first.id,
            "DELETE",
            undefined,
            token,
          ),
          404,
          "NOT_FOUND",
        );
        error(
          await request(
            "/" + id + "/default-address",
            "PUT",
            { addressId: first.id },
            token,
          ),
          404,
          "NOT_FOUND",
        );
        assert.equal(
          (await request("?phone=0912345678", "GET", undefined, token)).body
            .pagination.total,
          0,
        );
      }
      error(await request("/" + randomUUID()), 404, "NOT_FOUND");
      error(await request("/bad"), 400, "VALIDATION_ERROR");
      for (const field of [
        "ownerUserId",
        "createdByUserId",
        "code",
        "status",
        "userId",
      ])
        error(
          await request("", "POST", {
            name: "a",
            phone: "0987654321",
            [field]: "x",
          }),
          400,
          "VALIDATION_ERROR",
        );
      for (const payload of [{ name: "a", phone: "0987654321" }])
        for (const requestOrigin of [null, "https://untrusted.invalid"])
          error(
            await request("", "POST", payload, tokens[0], requestOrigin),
            403,
            "FORBIDDEN",
          );
      error(
        await request("", "POST", { name: "duplicate", phone: "+84912345678" }),
        409,
        "CUSTOMER_PHONE_EXISTS",
      );
      assert.equal(
        (
          await request(
            "",
            "POST",
            { name: "other owner", phone: "0912345678" },
            tokens[1],
          )
        ).status,
        201,
      );
      assert.equal(
        (await request("?phone=%2B84912345678")).body.customers[0].id,
        id,
      );
      assert.equal(
        (await request("?q=" + customer.code)).body.customers[0].id,
        id,
      );
      assert.equal((await request("?q=0912345678")).body.customers[0].id, id);
      assert.equal(
        (
          await request("", "POST", {
            name: "100%_literal",
            phone: "+442079460018",
          })
        ).status,
        201,
      );
      assert.equal(
        (await request("?q=" + encodeURIComponent("%_"))).body.pagination.total,
        1,
      );
      for (const query of [
        "?ownerUserId=x",
        "?page=0",
        "?pageSize=101",
        "?page=1&page=2",
      ])
        error(await request(query), 400, "VALIDATION_ERROR");
      for (const status of ["INACTIVE", "ACTIVE"])
        assert.equal(
          (
            await request("/" + id, "PATCH", {
              status,
              email: null,
              note: null,
            })
          ).body.customer.status,
          status,
        );
      const empty = await request("", "POST", {
        name: "No address",
        phone: "0987654321",
      });
      assert.equal(empty.status, 201);
      assert.deepEqual(empty.body.customer.addresses, []);
      error(
        await request("/" + empty.body.customer.id, "PATCH", {
          phone: "0912345678",
        }),
        409,
        "CUSTOMER_PHONE_EXISTS",
      );
      const pair = await Promise.all([
        request("", "POST", { name: "race1", phone: "0901234567" }),
        request("", "POST", { name: "race2", phone: "+84901234567" }),
      ]);
      assert.deepEqual(pair.map((x) => x.status).sort(), [201, 409]);
      const generated = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          request("", "POST", {
            name: "code race",
            phone: "+120255501" + String(i).padStart(2, "0"),
          }),
        ),
      );
      assert.ok(generated.every((x) => x.status === 201));
      assert.equal(new Set(generated.map((x) => x.body.customer.code)).size, 8);
      const page = await request("?pageSize=2");
      assert.equal(page.body.customers.length, 2);
      assert.equal(
        page.body.pagination.totalPages,
        Math.ceil(page.body.pagination.total / 2),
      );
      const next = await request("?page=2&pageSize=2");
      assert.ok(
        next.body.customers.every(
          (x) => !page.body.customers.some((y) => x.id === y.id),
        ),
      );
      const add = await request("/" + id + "/addresses", "POST", {
        addressText: "PII-SECOND",
        recipientName: "Other receiver",
        recipientPhone: "+12025550123",
      });
      assert.equal(add.status, 201);
      const second = add.body.address;
      assert.equal(second.isDefault, false);
      assert.equal(second.recipientPhone, "+12025550123");
      error(
        await request("/" + id + "/addresses/" + second.id, "PATCH", {
          isDefault: true,
        }),
        400,
        "VALIDATION_ERROR",
      );
      error(
        await request("/" + id + "/addresses", "POST", {
          addressText: "x",
          customerId: id,
        }),
        400,
        "VALIDATION_ERROR",
      );
      const another = empty.body.customer.id;
      error(
        await request("/" + another + "/addresses/" + second.id, "PATCH", {
          label: "reassign",
        }),
        404,
        "NOT_FOUND",
      );
      error(
        await request("/" + another + "/addresses/" + second.id, "DELETE"),
        404,
        "NOT_FOUND",
      );
      error(
        await request("/" + another + "/default-address", "PUT", {
          addressId: second.id,
        }),
        404,
        "NOT_FOUND",
      );
      const defaults = await Promise.all([
        request("/" + id + "/default-address", "PUT", { addressId: second.id }),
        request("/" + id + "/default-address", "PUT", { addressId: first.id }),
      ]);
      assert.ok(defaults.every((x) => x.status === 200));
      assert.equal(
        (await request("/" + id)).body.customer.addresses.filter(
          (x) => x.isDefault,
        ).length,
        1,
      );
      const selected = await request("/" + id + "/default-address", "PUT", {
        addressId: second.id,
      });
      assert.deepEqual(
        (
          await request("/" + id + "/default-address", "PUT", {
            addressId: second.id,
          })
        ).body,
        selected.body,
      );
      assert.equal(
        (
          await request("/" + id + "/addresses/" + second.id, "PATCH", {
            label: " Updated ",
          })
        ).body.address.label,
        "Updated",
      );
      assert.equal(
        (await request("/" + id + "/addresses/" + second.id, "DELETE")).body
          .success,
        true,
      );
      assert.equal(
        (await request("/" + id)).body.customer.addresses.filter(
          (x) => x.isDefault,
        ).length,
        0,
      );
      const afterDelete = await request("/" + id + "/addresses", "POST", {
        addressText: "new default",
      });
      assert.equal(afterDelete.body.address.isDefault, true);
      const emptyAdd = await request("/" + another + "/addresses", "POST", {
        addressText: "first",
      });
      assert.equal(emptyAdd.body.address.isDefault, true);
      const emptyRace = await request("", "POST", {
        name: "Concurrent addresses",
        phone: "+12025550199",
      });
      const raceId = emptyRace.body.customer.id;
      const additions = await Promise.all([
        request("/" + raceId + "/addresses", "POST", {
          addressText: "first candidate",
        }),
        request("/" + raceId + "/addresses", "POST", {
          addressText: "second candidate",
        }),
      ]);
      assert.ok(additions.every((r) => r.status === 201));
      assert.equal(
        (await request("/" + raceId)).body.customer.addresses.filter(
          (a) => a.isDefault,
        ).length,
        1,
      );
      // A transaction failure after customer INSERT must roll the entire initial-address operation back.
      await db.$executeRawUnsafe(
        "CREATE FUNCTION reject_customer_address_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$",
      );
      await db.$executeRawUnsafe(
        "CREATE TRIGGER reject_customer_address_fixture BEFORE INSERT ON customer_addresses FOR EACH ROW EXECUTE FUNCTION reject_customer_address_fixture()",
      );
      error(
        await request("", "POST", {
          name: "rollback",
          phone: "0932345678",
          address: { addressText: "rollback" },
        }),
        500,
        "INTERNAL_ERROR",
      );
      assert.equal(
        (await request("?phone=0932345678")).body.pagination.total,
        0,
      );
      await db.$executeRawUnsafe(
        "DROP TRIGGER reject_customer_address_fixture ON customer_addresses",
      );
      await db.$executeRawUnsafe(
        "DROP FUNCTION reject_customer_address_fixture()",
      );
      // Authenticated runtime authority, not merely grant-text inspection.
      await assert.rejects(
        store.client.$executeRawUnsafe("DELETE FROM customers"),
        (e) => e.code === "P2010" && e.meta?.code === "42501",
      );
      for (const sql of [
        "CREATE TABLE forbidden(id int)",
        "SELECT * FROM _prisma_migrations",
        "SELECT * FROM security_audit_events",
        "ALTER TABLE security_audit_events DISABLE TRIGGER ALL",
      ])
        await assert.rejects(store.client.$queryRawUnsafe(sql));
      const before = await db.customer.findMany({
        include: { addresses: true },
        orderBy: { id: "asc" },
      });
      await provisionRuntime(url.toString(), runtimePassword);
      assert.deepEqual(
        await db.customer.findMany({
          include: { addresses: true },
          orderBy: { id: "asc" },
        }),
        before,
      );
      await assert.rejects(
        db.user.delete({ where: { id: users[0].id } }),
        (e) => e.code === "P2003",
      );
      const expired = (
        await loginWithMfa(identity, users[1].username, "CustomerTestPass123!")
      ).token;
      await db.session.updateMany({
        where: {
          tokenHash: createHash("sha256").update(expired).digest("hex"),
        },
        data: { expiresAt: new Date(0) },
      });
      error(await request("", "GET", undefined, expired), 401, "UNAUTHORIZED");
      await identity.deleteSessionByTokenHash(
        createHash("sha256").update(tokens[1]).digest("hex"),
      );
      error(
        await request("", "GET", undefined, tokens[1]),
        401,
        "UNAUTHORIZED",
      );
      // Actual user-row lock waiter: disable commits first; waiting write must reject ACTIVE recheck.
      let release, locked;
      const acquired = new Promise((r) => (locked = r)),
        hold = new Promise((r) => (release = r));
      const disabling = db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id=${users[0].id}::uuid FOR UPDATE`;
        locked();
        await hold;
        await tx.user.update({
          where: { id: users[0].id },
          data: { status: "DISABLED" },
        });
      });
      await acquired;
      const pending = assert.rejects(
        store.update(users[0].id, id, { name: "must not commit" }),
        (e) => e.code === "UNAUTHORIZED",
      );
      let waiting = false;
      for (let i = 0; i < 80; i++) {
        const [row] = await db.$queryRawUnsafe(
          "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND usename='nexora_app' AND wait_event_type='Lock') AS waiting",
        );
        if (row.waiting) {
          waiting = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      release();
      await disabling;
      assert.equal(waiting, true);
      await pending;
      assert.equal(
        (await db.customer.findUnique({ where: { id } })).name,
        "PII-Customer-Secret",
      );
      error(await request(""), 401, "UNAUTHORIZED");
      assert.ok(
        logs.every(
          (line) =>
            ![
              "PII-Customer-Secret",
              "pii@example.test",
              "PII-NOTE",
              "PII-ADDRESS",
              "+84912345678",
            ].some((pii) => line.includes(pii)),
        ),
      );
    } finally {
      console.log = log;
      await app?.close();
      await store?.onApplicationShutdown();
      await identity?.onApplicationShutdown();
      await db?.$disconnect();
      if (owned)
        await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
      await admin.$disconnect();
      await rm(root, { recursive: true, force: true });
      for (const key of Object.keys(process.env))
        if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  },
);
