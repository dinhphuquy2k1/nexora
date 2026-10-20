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
      address: { addressText: "Hanoi" },
    }),
    {
      name: "Lan",
      phone: "+84912345678",
      email: "lan@example.com",
      note: "note",
      address: {
        label: null,
        recipientName: "Lan",
        recipientPhone: "+84912345678",
        countryCode: "VN",
        addressText: "Hanoi",
      },
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
      address: { addressText: "Valid" },
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
      {
        name: "Lan",
        phone: "0912345678",
        address: { addressText: "Valid" },
        ownerUserId: "foreign",
      },
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

test("create requires a valid initial address before any port call; PATCH remains independent", async () => {
  const {
    CustomerService,
  } = require("../dist/customer/application/customer.service");
  let calls = 0;
  const service = new CustomerService({
    create: async () => {
      calls++;
      return {};
    },
  });
  const base = { name: " Lan ", phone: "0912345678" };
  for (const input of [
    base,
    ...[
      null,
      {},
      [],
      { addressText: "" },
      { addressText: "  " },
      { addressText: "valid", isDefault: true },
    ].map((address) => ({ ...base, address })),
  ]) {
    assert.throws(
      () => customerInput(input),
      (e) => e.code === "VALIDATION_ERROR",
    );
    await assert.rejects(
      service.create({ id: "actor" }, input),
      (e) =>
        e.getStatus() === 400 && e.getResponse().code === "VALIDATION_ERROR",
    );
  }
  assert.equal(calls, 0);
  const normalized = customerInput({
    ...base,
    address: { addressText: " Hanoi " },
  });
  assert.equal(normalized.address.recipientName, "Lan");
  assert.equal(normalized.address.recipientPhone, "+84912345678");
  assert.equal(normalized.address.countryCode, "VN");
  assert.deepEqual(customerInput({ name: " Patched " }, true), {
    name: "Patched",
  });
  assert.throws(() =>
    customerInput({ address: { addressText: "not patchable" } }, true),
  );
});
test("address deletion policy preserves last/default priority and service409 messages", async () => {
  const {
    assertAddressDeletion,
    CustomerError,
  } = require("../dist/customer/domain/customer");
  const {
    CustomerService,
  } = require("../dist/customer/application/customer.service");
  for (const isDefault of [false, true])
    assert.throws(
      () => assertAddressDeletion(1, isDefault),
      (e) => e.code === "LAST_CUSTOMER_ADDRESS",
    );
  assert.throws(
    () => assertAddressDeletion(2, true),
    (e) => e.code === "DEFAULT_ADDRESS_REASSIGN_REQUIRED",
  );
  assert.doesNotThrow(() => assertAddressDeletion(2, false));
  const id = "11111111-1111-4111-8111-111111111111";
  for (const code of [
    "LAST_CUSTOMER_ADDRESS",
    "DEFAULT_ADDRESS_REASSIGN_REQUIRED",
  ]) {
    const service = new CustomerService({
      removeAddress: async () => {
        throw new CustomerError(code);
      },
    });
    await assert.rejects(
      service.removeAddress({ id: "actor" }, id, id),
      (e) =>
        e.getStatus() === 409 &&
        e.getResponse().code === code &&
        (code !== "LAST_CUSTOMER_ADDRESS" ||
          e.getResponse().message ===
            "Không thể xóa địa chỉ cuối cùng của khách hàng."),
    );
  }
});

test("generated contract requires initial address, leaves PATCH independent and documents delete409", () => {
  const document = require("../openapi/openapi.json");
  const schemas = document.components.schemas;
  assert.ok(schemas.CreateCustomerDto.required.includes("address"));
  assert.ok(!schemas.AddressInputDto.required.includes("recipientName"));
  assert.ok(!schemas.AddressInputDto.required.includes("recipientPhone"));
  assert.equal(schemas.PatchCustomerDto.properties.address, undefined);
  const conflict =
    document.paths["/api/customers/{id}/addresses/{addressId}"].delete
      .responses["409"];
  assert.match(
    conflict.description,
    /LAST_CUSTOMER_ADDRESS.*DEFAULT_ADDRESS_REASSIGN_REQUIRED/,
  );
  assert.equal(
    conflict.content["application/json"].schema.$ref,
    "#/components/schemas/ApiErrorDto",
  );
});

test("central Customer mapper preserves every code/status/message without leaking domain details", async () => {
  const { CustomerError } = require("../dist/customer/domain/customer");
  const {
    mapCustomerError,
    CUSTOMER_ERROR_MAP,
  } = require("../dist/customer/application/customer-error");
  const {
    CustomerService,
  } = require("../dist/customer/application/customer.service");
  const expected = [
    ["VALIDATION_ERROR", 400, "Không thể thực hiện yêu cầu"],
    ["UNAUTHORIZED", 401, "Không thể thực hiện yêu cầu"],
    ["NOT_FOUND", 404, "Không thể thực hiện yêu cầu"],
    ["CUSTOMER_PHONE_EXISTS", 409, "Không thể thực hiện yêu cầu"],
    [
      "LAST_CUSTOMER_ADDRESS",
      409,
      "Không thể xóa địa chỉ cuối cùng của khách hàng.",
    ],
    [
      "DEFAULT_ADDRESS_REASSIGN_REQUIRED",
      409,
      "Cần chuyển địa chỉ mặc định trước khi xóa.",
    ],
  ];
  assert.deepEqual(
    Object.keys(CUSTOMER_ERROR_MAP).sort(),
    expected.map(([code]) => code).sort(),
  );
  for (const [code, status, message] of expected) {
    const error = new CustomerError(code);
    error.message = "private database information";
    const mapped = mapCustomerError(error);
    assert.equal(mapped.getStatus(), status);
    assert.deepEqual(mapped.getResponse(), { code, message });
    const service = new CustomerService({
      list: async () => {
        throw error;
      },
    });
    await assert.rejects(service.list({ id: "actor" }, {}), (e) => {
      assert.equal(e.getStatus(), status);
      assert.deepEqual(e.getResponse(), { code, message });
      return true;
    });
  }
});

test("adding a CustomerError code without a mapping fails TypeScript exhaustiveness", () => {
  const ts = require("typescript");
  const path = require("node:path");
  const configPath = path.resolve(__dirname, "../tsconfig.customer-tests.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
  );
  const host = ts.createCompilerHost(parsed.options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (filename, languageVersion, ...rest) => {
    const source = original(filename, languageVersion, ...rest);
    if (source && filename.endsWith("/customer/domain/customer.ts")) {
      return ts.createSourceFile(
        filename,
        source.text.replace(
          '| "VALIDATION_ERROR"',
          '| "UNMAPPED_CUSTOMER_ERROR" | "VALIDATION_ERROR"',
        ),
        languageVersion,
        true,
      );
    }
    return source;
  };
  const program = ts.createProgram(
    parsed.fileNames,
    { ...parsed.options, noEmit: true },
    host,
  );
  const diagnostics = program.getSemanticDiagnostics();
  assert.ok(
    diagnostics.some(
      (d) =>
        d.file?.fileName.endsWith("/customer/application/customer-error.ts") &&
        ts
          .flattenDiagnosticMessageText(d.messageText, " ")
          .includes("UNMAPPED_CUSTOMER_ERROR"),
    ),
  );
});
