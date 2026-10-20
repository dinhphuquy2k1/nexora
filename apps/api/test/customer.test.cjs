const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizePhone,
  customerInput,
  addressInput,
  listQuery,
  uuid,
  CustomerStatus,
} = require("../dist/customer/domain/customer");
const {
  resolveCustomerOwner,
} = require("../dist/customer/application/customer-owner");
test("VN/international phones normalize and invalid numbering is rejected", () => {
  assert.equal(normalizePhone("0912345678"), "+84912345678");
  assert.equal(normalizePhone("+84912345678"), "+84912345678");
  assert.equal(normalizePhone("+1 202 555 0123"), "+12025550123");
  for (const v of [
    null,
    123,
    "abc",
    "123",
    "+849999999999999",
    "0912345678 ext 1",
  ])
    assert.throws(() => normalizePhone(v));
});
test("strict customer validation, nullable PATCH and canonical status", () => {
  assert.deepEqual(
    customerInput({
      name: " Lan ",
      phone: "0912345678",
      email: " lan@example.com ",
      note: " note ",
    }),
    {
      name: "Lan",
      phone: "+84912345678",
      email: "lan@example.com",
      note: "note",
    },
  );
  assert.deepEqual(
    customerInput(
      { email: null, note: null, status: CustomerStatus.INACTIVE },
      true,
    ),
    { email: null, note: null, status: CustomerStatus.INACTIVE },
  );
  for (const v of [
    {},
    { name: " " },
    { phone: "bad" },
    { status: "DISABLED" },
    { email: "bad@" },
    { note: "x".repeat(5001) },
    { name: null },
    { ownerUserId: "a" },
    { createdByUserId: "a" },
    { code: "KH123" },
    { id: "x" },
    { createdAt: "x" },
    null,
    [],
  ])
    assert.throws(() => customerInput(v, true));
  assert.throws(() =>
    customerInput({
      name: "a",
      phone: "0912345678",
      status: CustomerStatus.ACTIVE,
    }),
  );
});
test("address fallback and strict ISO country/fields", () => {
  assert.deepEqual(
    addressInput(
      { addressText: " Hanoi " },
      { name: "Lan", phone: "+84912345678" },
    ),
    {
      label: null,
      recipientName: "Lan",
      recipientPhone: "+84912345678",
      countryCode: "VN",
      addressText: "Hanoi",
    },
  );
  assert.equal(
    addressInput(
      { countryCode: "us", recipientPhone: "+12025550123" },
      undefined,
      true,
    ).countryCode,
    "US",
  );
  for (const v of [
    { isDefault: true },
    { customerId: "a" },
    { countryCode: "ZZ" },
    { countryCode: "XK" },
    { recipientName: null },
    { recipientPhone: "12" },
    { addressText: " " },
    {},
  ])
    assert.throws(() => addressInput(v, undefined, true));
});
test("ownership only trusts actor.id; query and UUID boundaries", () => {
  assert.equal(
    resolveCustomerOwner({ id: "actor", role: "ADMIN", ownerUserId: "other" }),
    "actor",
  );
  assert.deepEqual(listQuery({}), { page: 1, pageSize: 20 });
  assert.equal(
    listQuery({
      phone: "0912345678",
      q: " Lan ",
      status: CustomerStatus.ACTIVE,
    }).phone,
    "+84912345678",
  );
  for (const v of [
    { page: "0" },
    { page: "1.2" },
    { page: "01" },
    { pageSize: "101" },
    { page: ["1"] },
    { ownerUserId: "other" },
    { phone: "bad" },
    { status: "DISABLED" },
    { q: "a".repeat(201) },
  ])
    assert.throws(() => listQuery(v));
  assert.throws(() => uuid("bad"));
  assert.equal(
    uuid("11111111-1111-4111-8111-111111111111"),
    "11111111-1111-4111-8111-111111111111",
  );
});

test("service derives owner from actor and rejects mass assignment before port use", async () => {
  const {
    CustomerService,
  } = require("../dist/customer/application/customer.service");
  let called = 0;
  const service = new CustomerService({
    list: async (owner, query) => {
      called++;
      assert.equal(owner, "actor");
      return query;
    },
    create: async (owner, fields, address) => {
      called++;
      assert.equal(owner, "actor");
      assert.equal(fields.phone, "+84912345678");
      assert.equal(address.recipientName, "Lan");
      return { id: "created" };
    },
  });
  await service.list(
    { id: "actor", role: "ADMIN", ownerUserId: "foreign" },
    {},
  );
  assert.deepEqual(
    await service.create(
      { id: "actor" },
      { name: "Lan", phone: "0912345678", address: { addressText: "Hanoi" } },
    ),
    { customer: { id: "created" } },
  );
  await assert.rejects(
    service.create(
      { id: "actor" },
      { name: "Lan", phone: "0912345678", ownerUserId: "foreign" },
    ),
    (e) => e.getStatus() === 400 && e.getResponse().code === "VALIDATION_ERROR",
  );
  assert.equal(called, 2);
});
test("service maps only domain errors and never changes safe error envelope", async () => {
  const {
    CustomerService,
  } = require("../dist/customer/application/customer.service");
  const { CustomerError } = require("../dist/customer/domain/customer");
  for (const [code, status] of [
    ["NOT_FOUND", 404],
    ["UNAUTHORIZED", 401],
    ["CUSTOMER_PHONE_EXISTS", 409],
  ]) {
    const service = new CustomerService({
      list: async () => {
        throw new CustomerError(code);
      },
    });
    await assert.rejects(
      service.list({ id: "actor" }, {}),
      (e) => e.getStatus() === status && e.getResponse().code === code,
    );
  }
  const failure = new Error("database");
  await assert.rejects(
    new CustomerService({
      list: async () => {
        throw failure;
      },
    }).list({ id: "actor" }, {}),
    (e) => e === failure,
  );
});

test("only exact owner-phone unique failures become domain duplicates", () => {
  const {
    isOwnerPhoneConflict,
  } = require("../dist/customer/infrastructure/customer-db-error");
  for (const target of [
    "uq_customers_owner_phone",
    ["owner_user_id", "phone_normalized"],
    ["ownerUserId", "phone"],
  ])
    assert.equal(
      isOwnerPhoneConflict({ code: "P2002", meta: { target } }),
      true,
    );
  assert.equal(
    isOwnerPhoneConflict({
      code: "P2002",
      meta: {
        driverAdapterError: {
          cause: { constraint: { index: "uq_customers_owner_phone" } },
        },
      },
    }),
    true,
  );
  for (const e of [
    null,
    {},
    new Error("db"),
    { code: "P2002", meta: { target: ["code"] } },
    { code: "P2002", meta: { target: "uq_customers_code" } },
    { code: "P2003" },
    { code: "P2010", meta: { target: "uq_customers_owner_phone" } },
  ])
    assert.equal(isOwnerPhoneConflict(e), false);
});
