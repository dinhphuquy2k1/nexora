const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  CustomerAggregate,
} = require("../dist/customer/domain/customer.aggregate");
const {
  PhoneNumber,
  CountryCode,
} = require("../dist/customer/domain/customer.value-objects");
const { CustomerStatus } = require("../dist/customer/domain/customer");
const {
  hydrateCustomer,
} = require("../dist/customer/infrastructure/customer.mapper");
const profile = { name: " Lan ", phone: "0912345678" };
const address = { addressText: " Hanoi " };
const date = () => new Date("2026-10-21T00:00:00Z");
const fields = {
  label: null,
  recipientName: "Receiver",
  recipientPhone: "+84912345678",
  countryCode: "VN",
  addressText: "Hanoi",
};
function persisted(addresses = ["a", "b"]) {
  return {
    id: "customer",
    code: "KH000001",
    ownerUserId: "owner",
    createdByUserId: "creator",
    ...profile,
    name: "Lan",
    phone: "+84912345678",
    email: null,
    note: null,
    status: CustomerStatus.ACTIVE,
    createdAt: date(),
    updatedAt: date(),
    addresses: addresses.map((id, i) => ({
      ...fields,
      id,
      isDefault: i === 0,
      createdAt: date(),
      updatedAt: date(),
    })),
  };
}
const rejectsCode = (action, code) =>
  assert.throws(action, (e) => e.code === code);

test("new aggregate requires initial address and owns normalized fallback/default without generating identities", () => {
  for (const missing of [undefined, null, {}, [], { addressText: " " }])
    rejectsCode(
      () => CustomerAggregate.create(profile, missing),
      "VALIDATION_ERROR",
    );
  const customer = CustomerAggregate.create(profile, address);
  assert.deepEqual(customer.creation(), {
    fields: { name: "Lan", phone: "+84912345678" },
    address: { ...fields, recipientName: "Lan" },
    status: CustomerStatus.ACTIVE,
    isDefault: true,
  });
  const state = customer.snapshot();
  assert.equal(state.identity, null);
  assert.equal(state.addresses[0].id, null);
  assert.equal(state.addresses[0].isDefault, true);
});

test("phone and country Value Objects are immutable, equivalent after normalization and preserve rejected values", () => {
  const phone = PhoneNumber.create("0912345678");
  assert.equal(phone.value, "+84912345678");
  assert.ok(phone.equals(PhoneNumber.create("+84912345678")));
  assert.equal(PhoneNumber.create("+1 202 555 0123").value, "+12025550123");
  assert.equal(CountryCode.create(" us ").value, "US");
  assert.ok(CountryCode.create("vn").equals(CountryCode.create("VN")));
  assert.equal(Reflect.set(phone, "value", "bad"), false);
  for (const v of [null, 123, "123", "0912345678 ext 1"])
    rejectsCode(() => PhoneNumber.create(v), "VALIDATION_ERROR");
  for (const v of [null, "XK", "ZZ", "Vietnam"])
    rejectsCode(() => CountryCode.create(v), "VALIDATION_ERROR");
});

test("aggregate profile transitions preserve nullability, status policy and independent recipients", () => {
  const customer = CustomerAggregate.rehydrate(persisted());
  const before = customer.snapshot().addresses;
  assert.deepEqual(
    customer.updateProfile({
      name: " Updated ",
      phone: "+12025550123",
      email: null,
      note: " note ",
      status: CustomerStatus.INACTIVE,
    }),
    {
      name: "Updated",
      phone: "+12025550123",
      email: null,
      note: "note",
      status: CustomerStatus.INACTIVE,
    },
  );
  assert.deepEqual(customer.snapshot().addresses, before);
  assert.equal(customer.snapshot().profile.name, "Updated");
  assert.equal(customer.snapshot().status, CustomerStatus.INACTIVE);
  rejectsCode(
    () => customer.updateProfile({ status: "DISABLED" }),
    "VALIDATION_ERROR",
  );
  rejectsCode(
    () => customer.updateProfile({ phone: "bad" }),
    "VALIDATION_ERROR",
  );
  assert.equal(customer.snapshot().profile.phone, "+12025550123");
});

test("snapshots and rehydration never leak mutable state, identity or Date references", () => {
  const original = persisted();
  const customer = CustomerAggregate.rehydrate(original);
  original.addresses[0].recipientName = "changed";
  original.createdAt.setFullYear(1990);
  const state = customer.snapshot();
  state.identity.ownerUserId = "foreign";
  state.identity.createdByUserId = "foreign";
  state.identity.code = "KH999999";
  state.identity.createdAt.setFullYear(1991);
  state.addresses[0].isDefault = false;
  state.addresses[0].createdAt.setFullYear(1992);
  state.addresses.pop();
  state.profile.name = "mutated";
  const actual = customer.snapshot();
  assert.equal(actual.identity.ownerUserId, "owner");
  assert.equal(actual.identity.createdByUserId, "creator");
  assert.equal(actual.identity.code, "KH000001");
  assert.equal(actual.identity.createdAt.getUTCFullYear(), 2026);
  assert.equal(actual.addresses.length, 2);
  assert.equal(actual.addresses[0].isDefault, true);
  assert.equal(actual.addresses[0].createdAt.getUTCFullYear(), 2026);
  assert.equal(actual.addresses[0].recipientName, "Receiver");
  assert.equal(actual.profile.name, "Lan");
});

test("add/update Address use aggregate fallback/default policy and cannot patch ownership/default", () => {
  const customer = CustomerAggregate.rehydrate(persisted());
  const added = customer.addAddress({
    addressText: " New ",
    recipientName: " Other ",
    recipientPhone: "+12025550123",
    countryCode: "us",
  });
  assert.deepEqual(added, {
    label: null,
    recipientName: "Other",
    recipientPhone: "+12025550123",
    countryCode: "US",
    addressText: "New",
    isDefault: false,
  });
  added.isDefault = true;
  assert.equal(customer.snapshot().addresses.at(-1).isDefault, false);
  assert.deepEqual(
    customer.updateAddress("b", { label: null, recipientName: " Patched " }),
    { label: null, recipientName: "Patched" },
  );
  rejectsCode(
    () => customer.updateAddress("b", { isDefault: true }),
    "VALIDATION_ERROR",
  );
  rejectsCode(
    () => customer.updateAddress("b", { customerId: "foreign" }),
    "VALIDATION_ERROR",
  );
  assert.equal(customer.snapshot().addresses[1].isDefault, false);
});

test("address removal preserves membership then LAST then DEFAULT priority with no promotion", () => {
  const one = CustomerAggregate.rehydrate(persisted(["a"]));
  rejectsCode(() => one.removeAddress("foreign"), "NOT_FOUND");
  rejectsCode(() => one.removeAddress("a"), "LAST_CUSTOMER_ADDRESS");
  const two = CustomerAggregate.rehydrate(persisted());
  rejectsCode(
    () => two.removeAddress("a"),
    "DEFAULT_ADDRESS_REASSIGN_REQUIRED",
  );
  two.removeAddress("b");
  assert.equal(two.snapshot().addresses.length, 1);
  assert.equal(two.snapshot().addresses[0].id, "a");
  assert.equal(two.snapshot().addresses[0].isDefault, true);
});

test("default reassignment is explicit, idempotent, membership-bound and preserves recipient/timestamps", () => {
  const customer = CustomerAggregate.rehydrate(persisted());
  const before = customer.snapshot();
  rejectsCode(() => customer.setDefaultAddress("foreign"), "NOT_FOUND");
  assert.equal(customer.setDefaultAddress("a"), false);
  assert.deepEqual(customer.snapshot(), before);
  assert.equal(customer.setDefaultAddress("b"), true);
  assert.equal(customer.setDefaultAddress("b"), false);
  const after = customer.snapshot();
  assert.deepEqual(
    after.addresses.map((a) => a.isDefault),
    [false, true],
  );
  assert.deepEqual(
    after.addresses.map((a) => ({ ...a, isDefault: undefined })),
    before.addresses.map((a) => ({ ...a, isDefault: undefined })),
  );
  customer.removeAddress("a");
  assert.equal(customer.snapshot().addresses[0].id, "b");
});

test("zero/no-default legacy state hydrates unchanged and only owner-directed Add/Set repairs it", () => {
  const empty = CustomerAggregate.rehydrate(persisted([]));
  assert.equal(empty.snapshot().addresses.length, 0);
  empty.updateProfile({ note: "legacy" });
  assert.equal(empty.snapshot().addresses.length, 0);
  assert.equal(empty.addAddress(address).isDefault, true);
  assert.equal(empty.snapshot().addresses[0].recipientName, "Lan");
  const row = persisted();
  row.addresses.forEach((a) => (a.isDefault = false));
  const legacy = CustomerAggregate.rehydrate(row);
  assert.ok(legacy.snapshot().addresses.every((a) => !a.isDefault));
  legacy.updateAddress("a", { label: "Updated" });
  assert.ok(legacy.snapshot().addresses.every((a) => !a.isDefault));
  assert.equal(legacy.setDefaultAddress("b"), true);
  assert.deepEqual(
    legacy.snapshot().addresses.map((a) => a.isDefault),
    [false, true],
  );
  const another = CustomerAggregate.rehydrate(row);
  assert.equal(another.addAddress(address).isDefault, true);
  assert.equal(
    another.snapshot().addresses.filter((a) => a.isDefault).length,
    1,
  );
});

test("persistence hydration mapper keeps identity, legacy cardinality, nullable values and actual dates", () => {
  const row = persisted([]);
  const aggregate = hydrateCustomer(row);
  assert.deepEqual(aggregate.snapshot().identity, {
    id: row.id,
    code: row.code,
    ownerUserId: row.ownerUserId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
  assert.equal(aggregate.snapshot().profile.email, null);
  assert.deepEqual(aggregate.snapshot().addresses, []);
});

test("status VO accepts only shared codes, is immutable and rejects corrupt persisted status", () => {
  const {
    CustomerStatusVO,
  } = require("../dist/customer/domain/customer-status.vo");
  assert.equal(CustomerStatusVO.initial().value, CustomerStatus.ACTIVE);
  for (const code of Object.values(CustomerStatus)) {
    const value = CustomerStatusVO.from(code);
    assert.equal(value.value, code);
    assert.ok(value.equals(CustomerStatusVO.from(code)));
    assert.equal(Reflect.set(value, "value", "bad"), false);
  }
  assert.equal(
    CustomerStatusVO.from(CustomerStatus.ACTIVE).equals(
      CustomerStatusVO.from(CustomerStatus.INACTIVE),
    ),
    false,
  );
  for (const bad of [null, undefined, "", "active", "DISABLED", [], {}, 1]) {
    rejectsCode(() => CustomerStatusVO.from(bad), "VALIDATION_ERROR");
    rejectsCode(
      () => hydrateCustomer({ ...persisted(), status: bad }),
      "VALIDATION_ERROR",
    );
  }
});

test("all public domain command shapes reject mixed forbidden fields without mutating state", () => {
  const customer = CustomerAggregate.rehydrate(persisted());
  const before = customer.snapshot();
  for (const bad of [null, undefined, [], "text", 1, {}]) {
    rejectsCode(() => customer.updateProfile(bad), "VALIDATION_ERROR");
    rejectsCode(() => customer.updateAddress("a", bad), "VALIDATION_ERROR");
    rejectsCode(() => customer.addAddress(bad), "VALIDATION_ERROR");
    rejectsCode(
      () => CustomerAggregate.create(bad, address),
      "VALIDATION_ERROR",
    );
  }
  for (const key of [
    "ownerUserId",
    "createdByUserId",
    "id",
    "code",
    "statusLabel",
    "address",
    "unknown",
  ]) {
    rejectsCode(
      () => customer.updateProfile({ name: "Valid", [key]: "forged" }),
      "VALIDATION_ERROR",
    );
    rejectsCode(
      () => CustomerAggregate.create({ ...profile, [key]: "forged" }, address),
      "VALIDATION_ERROR",
    );
  }
  for (const key of [
    "customerId",
    "ownerUserId",
    "id",
    "isDefault",
    "statusLabel",
    "unknown",
  ]) {
    rejectsCode(
      () => customer.updateAddress("a", { label: "Valid", [key]: true }),
      "VALIDATION_ERROR",
    );
    rejectsCode(
      () => customer.addAddress({ ...address, [key]: true }),
      "VALIDATION_ERROR",
    );
    rejectsCode(
      () => CustomerAggregate.create(profile, { ...address, [key]: true }),
      "VALIDATION_ERROR",
    );
  }
  const symbolic = { name: "Valid", [Symbol("owner")]: "forged" };
  rejectsCode(() => customer.updateProfile(symbolic), "VALIDATION_ERROR");
  assert.deepEqual(customer.snapshot(), before);
  assert.deepEqual(customer.updateProfile({ name: " Updated " }), {
    name: "Updated",
  });
});

test("profile-only policy is shared with aggregate and independent of legacy child cardinality", () => {
  const {
    changeCustomerProfile,
  } = require("../dist/customer/domain/customer-profile.policy");
  for (const code of Object.values(CustomerStatus)) {
    const patch = { status: code, email: null, note: null, name: " Updated " };
    const expected = changeCustomerProfile(CustomerStatus.ACTIVE, patch);
    for (const ids of [[], ["a"], ["a", "b"]]) {
      const aggregate = CustomerAggregate.rehydrate(persisted(ids));
      const before = aggregate.snapshot().addresses;
      assert.deepEqual(aggregate.updateProfile(patch), expected);
      assert.deepEqual(aggregate.snapshot().addresses, before);
    }
  }
  rejectsCode(
    () => changeCustomerProfile("corrupt", { name: "Valid" }),
    "VALIDATION_ERROR",
  );
  rejectsCode(
    () =>
      changeCustomerProfile(CustomerStatus.ACTIVE, {
        name: "Valid",
        isDefault: true,
      }),
    "VALIDATION_ERROR",
  );
});

test("presentation adds shared labels, allowlists safe fields and preserves ordered addresses and JSON dates", () => {
  const {
    presentCustomer,
    presentCustomerPage,
  } = require("../dist/customer/presentation/customer.presenter");
  const { CustomerStatusLabelsVi } = require("@nexora/shared");
  const row = persisted();
  for (const code of Object.values(CustomerStatus)) {
    row.status = code;
    const before = persisted();
    before.status = code;
    const result = presentCustomer(row);
    assert.equal(result.statusLabel, CustomerStatusLabelsVi[code]);
    assert.equal(result.status, code);
    assert.equal(result.ownerUserId, undefined);
    assert.equal(result.createdByUserId, undefined);
    assert.equal(
      JSON.parse(JSON.stringify(result)).createdAt,
      row.createdAt.toISOString(),
    );
    assert.deepEqual(result.addresses, row.addresses);
    assert.deepEqual(row, before);
    assert.equal(
      presentCustomerPage({
        customers: [row],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }).customers[0].statusLabel,
      CustomerStatusLabelsVi[code],
    );
  }
});

test("all four Customer controller handlers present labels once; address handlers remain unchanged", async () => {
  const {
    CustomerController,
  } = require("../dist/customer/presentation/customer.controller");
  const row = persisted();
  const page = {
    customers: [row],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  };
  const actor = { user: { id: "owner" } };
  const addressResult = { address: row.addresses[0] };
  const service = {
    list: async () => page,
    create: async () => ({ customer: row }),
    get: async () => ({ customer: row }),
    update: async () => ({
      customer: { ...row, status: CustomerStatus.INACTIVE },
    }),
    addAddress: async () => addressResult,
  };
  const controller = new CustomerController(service);
  assert.equal(
    (await controller.list(actor, {})).customers[0].statusLabel,
    "Đang hoạt động",
  );
  assert.equal(
    (await controller.create(actor, {})).customer.statusLabel,
    "Đang hoạt động",
  );
  assert.equal(
    (await controller.get(actor, "id")).customer.statusLabel,
    "Đang hoạt động",
  );
  assert.equal(
    (await controller.update(actor, "id", {})).customer.statusLabel,
    "Ngừng hoạt động",
  );
  assert.equal(await controller.add(actor, "id", {}), addressResult);
  assert.equal(Object.hasOwn(row, "statusLabel"), false);
});
