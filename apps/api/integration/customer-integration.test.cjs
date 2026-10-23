// Requires genuine generated Prisma client and migrated PostgreSQL; no mocked auth/DB.
require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { mkdtemp, rm, readFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { URLSearchParams } = require("node:url");
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
const { loginWithMfa } = require("../test/helpers/mfa-fixture.cjs");
test(
  "Customer real Nest/PostgreSQL owner security, transactions, concurrency and runtime authority",
  { timeout: 180000 },
  async (t) => {
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
        if (response.ok) {
          const { CustomerStatusLabelsVi } = require("@nexora/shared");
          for (const customer of result.customers ??
            (result.customer ? [result.customer] : [])) {
            assert.equal(
              customer.statusLabel,
              CustomerStatusLabelsVi[customer.status],
            );
            assert.equal(customer.ownerUserId, undefined);
            assert.equal(customer.createdByUserId, undefined);
          }
          if (result.address)
            assert.equal(Object.hasOwn(result.address, "statusLabel"), false);
        }
        if (response.ok && method !== "GET") {
          const customerId = result.customer?.id ?? path.split("/")[1];
          const addresses = await db.customerAddress.findMany({
            where: { customerId },
          });
          assert.ok(
            addresses.length >= 1,
            "successful API mutation preserves at least one address",
          );
          const defaults = addresses.filter((a) => a.isDefault);
          assert.equal(
            defaults.length,
            1,
            "successful API mutation preserves exactly one default",
          );
          assert.equal(defaults[0].customerId, customerId);
        }
        return { status: response.status, body: result };
      }
      const error = (r, status, code) => {
        assert.equal(r.status, status);
        assert.equal(r.body.code, code);
      };
      error(await request("", "GET", undefined, null), 401, "UNAUTHORIZED");
      const otherRecipient = await request("", "POST", {
        name: "Independent customer",
        phone: "+12025550197",
        address: {
          addressText: "Valid full address",
          recipientName: "Independent receiver",
          recipientPhone: "+442079460018",
        },
      });
      assert.equal(otherRecipient.status, 201);
      assert.equal(
        otherRecipient.body.customer.addresses[0].recipientName,
        "Independent receiver",
      );
      assert.equal(
        otherRecipient.body.customer.addresses[0].recipientPhone,
        "+442079460018",
      );
      const baseCreate = {
        name: "Invalid initial address",
        phone: "0988123456",
      };
      for (const body of [
        baseCreate,
        ...[
          null,
          {},
          [],
          { addressText: "" },
          { addressText: "  " },
          { addressText: "valid", isDefault: true },
        ].map((address) => ({ ...baseCreate, address })),
      ])
        error(await request("", "POST", body), 400, "VALIDATION_ERROR");
      assert.equal(
        (await request("?phone=0988123456")).body.pagination.total,
        0,
      );
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
          "statusLabel",
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
            address: { addressText: "Fixture initial address" },
            name: "a",
            phone: "0987654321",
            [field]: "x",
          }),
          400,
          "VALIDATION_ERROR",
        );
      for (const payload of [
        { name: "a", phone: "0987654321", address: { addressText: "Valid" } },
      ])
        for (const requestOrigin of [null, "https://untrusted.invalid"])
          error(
            await request("", "POST", payload, tokens[0], requestOrigin),
            403,
            "FORBIDDEN",
          );
      error(
        await request("", "POST", {
          address: { addressText: "Fixture initial address" },
          name: "duplicate",
          phone: "+84912345678",
        }),
        409,
        "CUSTOMER_PHONE_EXISTS",
      );
      assert.equal(
        (
          await request(
            "",
            "POST",
            {
              address: { addressText: "Fixture initial address" },
              name: "other owner",
              phone: "0912345678",
            },
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
            address: { addressText: "Fixture initial address" },
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
        address: { addressText: "Fixture initial address" },
        name: "Second customer",
        phone: "0987654321",
      });
      assert.equal(empty.status, 201);
      assert.equal(empty.body.customer.addresses.length, 1);
      assert.equal(empty.body.customer.addresses[0].isDefault, true);
      error(
        await request("/" + empty.body.customer.id, "PATCH", {
          phone: "0912345678",
        }),
        409,
        "CUSTOMER_PHONE_EXISTS",
      );
      const pair = await Promise.all([
        request("", "POST", {
          address: { addressText: "Fixture initial address" },
          name: "race1",
          phone: "0901234567",
        }),
        request("", "POST", {
          address: { addressText: "Fixture initial address" },
          name: "race2",
          phone: "+84901234567",
        }),
      ]);
      assert.deepEqual(pair.map((x) => x.status).sort(), [201, 409]);
      const generated = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          request("", "POST", {
            address: { addressText: "Fixture initial address" },
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
      const lastDelete = await request(
        "/" + id + "/addresses/" + first.id,
        "DELETE",
      );
      error(lastDelete, 409, "LAST_CUSTOMER_ADDRESS");
      assert.equal(
        lastDelete.body.message,
        "Không thể xóa địa chỉ cuối cùng của khách hàng.",
      );
      error(
        await request("/" + id + "/addresses/" + randomUUID(), "DELETE"),
        404,
        "NOT_FOUND",
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
      error(
        await request("/" + id + "/addresses/" + second.id, "DELETE"),
        409,
        "DEFAULT_ADDRESS_REASSIGN_REQUIRED",
      );
      assert.equal(
        (
          await request("/" + id + "/default-address", "PUT", {
            addressId: first.id,
          })
        ).status,
        200,
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
        1,
      );
      const afterDelete = await request("/" + id + "/addresses", "POST", {
        addressText: "new default",
      });
      assert.equal(afterDelete.body.address.isDefault, false);
      const emptyAdd = await request("/" + another + "/addresses", "POST", {
        addressText: "first",
      });
      assert.equal(emptyAdd.body.address.isDefault, false);
      const emptyRace = await request("", "POST", {
        address: { addressText: "Fixture initial address" },
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
      // Both delete orders retain the last default; foreign/missing precedence stays404.
      const raceAddresses = (await request("/" + raceId)).body.customer
        .addresses;
      const raceDefault = raceAddresses.find((a) => a.isDefault),
        aux = raceAddresses.filter((a) => !a.isDefault);
      const deleteAux = await Promise.all(
        aux.map((a) => request("/" + raceId + "/addresses/" + a.id, "DELETE")),
      );
      assert.ok(deleteAux.every((r) => r.status === 200));
      error(
        await request("/" + raceId + "/addresses/" + raceDefault.id, "DELETE"),
        409,
        "LAST_CUSTOMER_ADDRESS",
      );
      const candidate = (
        await request("/" + raceId + "/addresses", "POST", {
          addressText: "Replacement candidate",
        })
      ).body.address;
      const deleteBoth = await Promise.all([
        request("/" + raceId + "/addresses/" + raceDefault.id, "DELETE"),
        request("/" + raceId + "/addresses/" + candidate.id, "DELETE"),
      ]);
      assert.equal(deleteBoth[0].status, 409);
      assert.ok(
        ["LAST_CUSTOMER_ADDRESS", "DEFAULT_ADDRESS_REASSIGN_REQUIRED"].includes(
          deleteBoth[0].body.code,
        ),
      );
      assert.equal(deleteBoth[1].status, 200);
      const target = (
        await request("/" + raceId + "/addresses", "POST", {
          addressText: "Switch candidate",
        })
      ).body.address;
      const deleteVsDefault = await Promise.all([
        request("/" + raceId + "/addresses/" + raceDefault.id, "DELETE"),
        request("/" + raceId + "/default-address", "PUT", {
          addressId: target.id,
        }),
      ]);
      assert.ok([200, 409].includes(deleteVsDefault[0].status));
      if (deleteVsDefault[0].status === 409)
        assert.equal(
          deleteVsDefault[0].body.code,
          "DEFAULT_ADDRESS_REASSIGN_REQUIRED",
        );
      assert.equal(deleteVsDefault[1].status, 200);
      const secondary = (
        await request("/" + raceId + "/addresses", "POST", {
          addressText: "Delete while adding",
        })
      ).body.address;
      const addVsDelete = await Promise.all([
        request("/" + raceId + "/addresses", "POST", {
          addressText: "Concurrent real address",
        }),
        request("/" + raceId + "/addresses/" + secondary.id, "DELETE"),
      ]);
      assert.equal(addVsDelete[0].status, 201);
      assert.equal(addVsDelete[1].status, 200);
      // DDD refactor compatibility: profile writes must not rewrite child rows or leak identity metadata.
      const reference = await request("", "POST", {
        name: "DDD profile before",
        phone: "+12025550195",
        address: { addressText: "DDD initial address" },
      });
      assert.equal(reference.status, 201);
      const referenceCustomer = reference.body.customer;
      assert.deepEqual(
        Object.keys(referenceCustomer).sort(),
        [
          "id",
          "code",
          "name",
          "phone",
          "email",
          "note",
          "status",
          "statusLabel",
          "createdAt",
          "updatedAt",
          "addresses",
        ].sort(),
      );
      const originalAddresses = referenceCustomer.addresses;
      const {
        CustomerPort,
      } = require("../dist/customer/application/customer.port");
      const apiCustomers = app.get(CustomerPort);
      const originalClient = apiCustomers.client;
      const profileQueries = [];
      apiCustomers.instance = originalClient.$extends({
        query: {
          $allOperations: async ({ model, operation, args, query }) => {
            profileQueries.push({ model, operation, select: args?.select });
            return query(args);
          },
        },
      });
      const changedProfile = await request(
        "/" + referenceCustomer.id,
        "PATCH",
        {
          name: "DDD profile after",
          phone: "+12025550194",
          status: "INACTIVE",
          email: null,
          note: null,
        },
      );
      apiCustomers.instance = originalClient;
      assert.equal(changedProfile.status, 200);
      assert.deepEqual(
        profileQueries.map((q) => q.operation),
        ["$queryRaw", "$queryRaw", "findFirst", "updateMany", "findFirst"],
      );
      const selects = profileQueries.filter(
        (q) => q.model === "Customer" && q.operation === "findFirst",
      );
      assert.deepEqual(selects[0].select, { status: true });
      assert.equal(selects.filter((q) => q.select.addresses).length, 1);
      assert.equal(changedProfile.body.customer.statusLabel, "Ngừng hoạt động");
      for (const method of ["POST", "PATCH"]) {
        error(
          await request(
            method === "POST" ? "" : "/" + referenceCustomer.id,
            method,
            { name: "Valid", statusLabel: "Đang hoạt động" },
          ),
          400,
          "VALIDATION_ERROR",
        );
      }
      const storedProfile = await db.customer.findUnique({
        where: { id: referenceCustomer.id },
      });
      assert.equal(storedProfile.status, "INACTIVE");
      assert.equal(Object.hasOwn(storedProfile, "statusLabel"), false);
      assert.deepEqual(
        changedProfile.body.customer.addresses,
        originalAddresses,
      );
      assert.equal(changedProfile.body.customer.status, "INACTIVE");
      const newRecipient = await request(
        "/" + referenceCustomer.id + "/addresses",
        "POST",
        { addressText: "DDD next address" },
      );
      assert.equal(newRecipient.status, 201);
      assert.equal(
        newRecipient.body.address.recipientName,
        "DDD profile after",
      );
      assert.equal(newRecipient.body.address.recipientPhone, "+12025550194");
      assert.equal(newRecipient.body.address.isDefault, false);
      assert.equal(
        (await request("/" + referenceCustomer.id)).body.customer.addresses[0]
          .id,
        originalAddresses[0].id,
      );
      // Explicit legacy fixtures bypass the API to exercise controlled recovery, never fake shipping data.
      const legacy = await db.customer.create({
        data: {
          ownerUserId: users[0].id,
          createdByUserId: users[0].id,
          name: "Legacy repair",
          phone: "+12025550198",
          status: "ACTIVE",
        },
      });
      assert.equal(
        (await request("/" + legacy.id)).body.customer.addresses.length,
        0,
      );
      const repaired = (
        await request("/" + legacy.id + "/addresses", "POST", {
          addressText: "Owner supplied real repair address",
        })
      ).body.address;
      assert.equal(repaired.isDefault, true);
      await db.customerAddress.updateMany({
        where: { customerId: legacy.id },
        data: { isDefault: false },
      });
      assert.equal(
        (
          await request("/" + legacy.id + "/default-address", "PUT", {
            addressId: repaired.id,
          })
        ).body.address.isDefault,
        true,
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
        (e) =>
          e.code === "P2010" &&
          (e.meta?.code === "42501" ||
            e.meta?.driverAdapterError?.cause?.code === "42501"),
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
      // NEXORA-030: real HTTP + existing migrated, restricted runtime fixtures.
      // ADMIN starts with no customers; other owners already have independent data.
      const statsPrefix = "Stats030";
      const statsPath = (query = {}) =>
        "?" + new URLSearchParams({ q: statsPrefix, ...query });
      const expectStats = (result, stats) => {
        assert.equal(result.status, 200);
        assert.deepEqual(result.body.stats, stats);
        assert.deepEqual(Object.keys(result.body.stats).sort(), [
          "active",
          "inactive",
          "total",
        ]);
        for (const value of Object.values(result.body.stats))
          assert.ok(Number.isSafeInteger(value) && value >= 0);
        assert.equal(stats.total, stats.active + stats.inactive);
      };
      const adminRequest = (query = {}) =>
        request(statsPath(query), "GET", undefined, tokens[2]);
      await t.test(
        "stats empty ADMIN population does not infer other owners",
        async () => {
          expectStats(await request("", "GET", undefined, tokens[2]), {
            total: 0,
            active: 0,
            inactive: 0,
          });
        },
      );
      const statCustomers = [];
      for (const [i, phone] of [
        "+14155552671",
        "+442079460099",
        "+84987654321",
      ].entries()) {
        const created = await request(
          "",
          "POST",
          {
            name: statsPrefix + [" Alpha%_\\literal", " Beta", " Gamma"][i],
            phone,
            address: { addressText: "Statistics fixture" },
          },
          tokens[2],
        );
        assert.equal(created.status, 201);
        statCustomers.push(created.body.customer);
      }
      await t.test("all ACTIVE and committed create refresh", async () => {
        expectStats(await adminRequest(), { total: 3, active: 3, inactive: 0 });
      });
      for (const row of statCustomers) {
        const changed = await request(
          "/" + row.id,
          "PATCH",
          { status: "INACTIVE" },
          tokens[2],
        );
        assert.equal(changed.status, 200);
      }
      await t.test("all INACTIVE and missing ACTIVE group", async () => {
        expectStats(await adminRequest(), { total: 3, active: 0, inactive: 3 });
      });
      assert.equal(
        (
          await request(
            "/" + statCustomers[0].id,
            "PATCH",
            { status: "ACTIVE" },
            tokens[2],
          )
        ).status,
        200,
      );
      const mixedStats = { total: 3, active: 1, inactive: 2 };
      await t.test("mixed statuses and sum invariant", async () => {
        expectStats(await adminRequest(), mixedStats);
      });
      for (const [status, total] of [
        ["ACTIVE", 1],
        ["INACTIVE", 2],
      ])
        await t.test(
          "selected " + status + " affects pagination only",
          async () => {
            const result = await adminRequest({ status });
            expectStats(result, mixedStats);
            assert.equal(result.body.pagination.total, total);
            assert.ok(
              result.body.customers.every((row) => row.status === status),
            );
          },
        );
      for (const query of [
        { page: "2", pageSize: "1" },
        { pageSize: "2" },
        { page: "2147483647", pageSize: "1" },
      ])
        await t.test(
          "pagination-independent stats " + JSON.stringify(query),
          async () => {
            const result = await adminRequest(query);
            expectStats(result, mixedStats);
            assert.equal(result.body.pagination.total, 3);
          },
        );
      await t.test(
        "q scopes keyword/code/literal wildcard search identically",
        async () => {
          for (const q of [
            statsPrefix + " Alpha",
            "%_",
            "\\literal",
            statCustomers[0].code,
          ]) {
            const result = await request(
              "?" + new URLSearchParams({ q }),
              "GET",
              undefined,
              tokens[2],
            );
            expectStats(result, { total: 1, active: 1, inactive: 0 });
            assert.equal(result.body.pagination.total, 1);
            assert.equal(result.body.customers[0].id, statCustomers[0].id);
          }
        },
      );
      await t.test(
        "exact and searchPhone national/international filters share population",
        async () => {
          for (const query of [
            { phone: "0987654321" },
            { phone: "+84987654321" },
            { q: "0987654321" },
            { q: "+84987654321" },
          ]) {
            const result = await adminRequest(query);
            expectStats(result, { total: 1, active: 0, inactive: 1 });
            assert.equal(result.body.customers[0].id, statCustomers[2].id);
            assert.equal(result.body.pagination.total, 1);
          }
          expectStats(
            await adminRequest({
              phone: "+14155552671",
              q: statsPrefix + " Beta",
            }),
            { total: 0, active: 0, inactive: 0 },
          );
        },
      );
      await t.test(
        "same normalized phone under OPERATOR and ADMIN stays owner-scoped",
        async () => {
          for (const token of [tokens[0], tokens[1]]) {
            const created = await request(
              "",
              "POST",
              {
                name: statsPrefix + " Other owner",
                phone: "+14155552671",
                address: { addressText: "Independent fixture" },
              },
              token,
            );
            assert.equal(created.status, 201);
            expectStats(await request(statsPath(), "GET", undefined, token), {
              total: 1,
              active: 1,
              inactive: 0,
            });
          }
          expectStats(await adminRequest(), mixedStats);
          for (const token of tokens)
            expectStats(
              await request(
                statsPath({ phone: "+14155552671" }),
                "GET",
                undefined,
                token,
              ),
              { total: 1, active: 1, inactive: 0 },
            );
        },
      );
      await t.test(
        "invalid queries retain safe400 and cannot override owner",
        async () => {
          for (const query of [
            "?q=",
            "?ownerId=x",
            "?status=UNKNOWN",
            "?q=x&q=y",
            "?page=01",
          ])
            error(await request(query), 400, "VALIDATION_ERROR");
        },
      );
      await t.test(
        "reversed groups preserve counts; unexpected group fails safe500",
        async () => {
          apiCustomers.instance = originalClient.$extends({
            query: {
              customer: {
                groupBy: async ({ args, query }) =>
                  (await query(args)).reverse(),
              },
            },
          });
          try {
            expectStats(await adminRequest(), mixedStats);
          } finally {
            apiCustomers.instance = originalClient;
          }
          // Controlled malformed result AFTER the real DB query, without altering schema/CHECK/data.
          apiCustomers.instance = originalClient.$extends({
            query: {
              customer: {
                groupBy: async ({ args, query }) => [
                  ...(await query(args)),
                  { status: "CORRUPT-PII-DO-NOT-LOG", _count: { _all: 1 } },
                ],
              },
            },
          });
          try {
            const result = await adminRequest();
            error(result, 500, "INTERNAL_ERROR");
            assert.ok(!JSON.stringify(result.body).includes("CORRUPT"));
            assert.ok(logs.every((line) => !line.includes("CORRUPT")));
          } finally {
            apiCustomers.instance = originalClient;
          }
        },
      );
      await t.test(
        "large multipage population uses one group and bounded summary, no addresses",
        async () => {
          // Valid owned synthetic fixture in this suite's disposable DB; no production data.
          await originalClient.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM users WHERE id=${users[2].id}::uuid FOR UPDATE`;
            const rows = await tx.customer.createManyAndReturn({
              data: Array.from({ length: 105 }, (_, i) => ({
                ownerUserId: users[2].id,
                createdByUserId: users[2].id,
                name: statsPrefix + " Bulk",
                phone: "+1202555" + (1000 + i),
                status: i % 2 ? "INACTIVE" : "ACTIVE",
              })),
              select: { id: true, phone: true },
            });
            await tx.customerAddress.createMany({
              data: rows.map((row) => ({
                customerId: row.id,
                recipientName: "Bulk receiver",
                recipientPhone: row.phone,
                countryCode: "VN",
                addressText: "Bulk fixture",
                isDefault: true,
              })),
            });
          });
          const queries = [];
          apiCustomers.instance = originalClient.$extends({
            query: {
              $allOperations: async ({ model, operation, args, query }) => {
                queries.push({ model, operation, args });
                return query(args);
              },
            },
          });
          try {
            const result = await adminRequest({
              page: "2",
              pageSize: "2",
              status: "ACTIVE",
            });
            expectStats(result, { total: 108, active: 54, inactive: 54 });
            assert.equal(result.body.customers.length, 2);
            assert.equal(result.body.pagination.total, 54);
            assert.deepEqual(
              queries.map((row) => row.operation),
              ["$queryRaw", "count", "findMany", "groupBy"],
            );
            const count = queries.find((row) => row.operation === "count").args;
            const page = queries.find(
              (row) => row.operation === "findMany",
            ).args;
            const grouped = queries.find(
              (row) => row.operation === "groupBy",
            ).args;
            assert.deepEqual(page.where, count.where);
            const { status, ...baseWhere } = count.where;
            assert.equal(status, "ACTIVE");
            assert.deepEqual(grouped.where, baseWhere);
            assert.equal(grouped.where.ownerUserId, users[2].id);
            assert.deepEqual(grouped.by, ["status"]);
            assert.deepEqual(grouped._count, { _all: true });
            assert.equal(page.skip, 2);
            assert.equal(page.take, 2);
            assert.equal(page.select.addresses, undefined);
            assert.deepEqual(page.orderBy, [
              { createdAt: "desc" },
              { id: "desc" },
            ]);
          } finally {
            apiCustomers.instance = originalClient;
          }
        },
      );
      await t.test(
        "read waits for owner commit while another owner remains independent",
        async () => {
          let release, locked;
          const hold = new Promise((r) => (release = r));
          const acquired = new Promise((r) => (locked = r));
          const writing = db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM users WHERE id=${users[2].id}::uuid FOR UPDATE`;
            await tx.customer.update({
              where: { id: statCustomers[0].id },
              data: { status: "INACTIVE" },
            });
            locked();
            await hold;
          });
          await acquired;
          let result,
            waiting = false;
          const read = adminRequest().then((value) => (result = value));
          try {
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
            assert.equal(waiting, true);
            assert.equal(result, undefined);
            expectStats(await request(statsPath()), {
              total: 1,
              active: 1,
              inactive: 0,
            });
          } finally {
            release();
            await writing;
            await read;
          }
          expectStats(result, { total: 108, active: 53, inactive: 55 });
        },
      );

      await t.test(
        "read-first blocks writer and returns coherent pre-write stats",
        async () => {
          let release, locked;
          const hold = new Promise((r) => (release = r));
          const acquired = new Promise((r) => (locked = r));
          apiCustomers.instance = originalClient.$extends({
            query: {
              customer: {
                groupBy: async ({ args, query }) => {
                  locked();
                  await hold;
                  return query(args);
                },
              },
            },
          });
          const read = adminRequest();
          await acquired;
          let changed = false,
            waiting = false;
          const write = store
            .update(users[2].id, statCustomers[0].id, { status: "ACTIVE" })
            .then(() => {
              changed = true;
            });
          try {
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
            assert.equal(waiting, true);
            assert.equal(changed, false);
          } finally {
            release();
            apiCustomers.instance = originalClient;
            await read;
            await write;
          }
          expectStats(await read, { total: 108, active: 53, inactive: 55 });
          expectStats(await adminRequest(), {
            total: 108,
            active: 54,
            inactive: 54,
          });
        },
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
      const pendingRead = assert.rejects(
        store.list(users[0].id, { page: 1, pageSize: 20 }),
        (e) => e.code === "UNAUTHORIZED",
      );
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
      await pendingRead;
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
