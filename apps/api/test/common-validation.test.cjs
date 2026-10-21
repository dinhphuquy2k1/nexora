const { test } = require("node:test");
const assert = require("node:assert/strict");

const { isUuid } = require("../dist/common/validation/uuid");
const { isLowercaseHex64 } = require("../dist/common/validation/hex");
const {
  PhoneNumber,
  InvalidPhoneNumberError,
} = require("../dist/common/value-objects/phone-number");
const {
  CountryCode,
  InvalidCountryCodeError,
} = require("../dist/common/value-objects/country-code");
const {
  uuid: customerUuid,
} = require("../dist/customer/application/customer.input");
const { CustomerError } = require("../dist/customer/domain/customer");

test("isUuid: validates 8-4-4-4-12 hex groups case-insensitively without version restriction or implicit trimming", () => {
  // Valid UUIDs across different versions and cases
  const valid = [
    "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "A1B2C3D4-E5F6-7A8B-9C0D-1E2F3A4B5C6D",
    "00000000-0000-0000-0000-000000000000",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
    "123e4567-e89b-12d3-a456-426614174000", // v1
    "c9b84172-5b9c-4e89-9a27-a48f4e69b02a", // v4
    "987fbc97-4bed-5078-af07-9141ba07c9f3", // v5
  ];
  for (const id of valid) {
    assert.equal(isUuid(id), true, `Expected valid UUID: ${id}`);
  }

  // Invalid UUIDs
  const invalid = [
    "",
    "   ",
    null,
    undefined,
    12345,
    {},
    [],
    "c9b84172-5b9c-4e89-9a27-a48f4e69b02", // 1 char short in last group
    "c9b84172-5b9c-4e89-9a27-a48f4e69b02aa", // 1 char too long in last group
    "c9b841725b9c4e899a27a48f4e69b02a", // no hyphens
    "c9b84172-5b9c-4e89-9a27_a48f4e69b02a", // underscore
    "g9b84172-5b9c-4e89-9a27-a48f4e69b02a", // non-hex 'g'
    " c9b84172-5b9c-4e89-9a27-a48f4e69b02a", // leading space (no implicit trimming)
    "c9b84172-5b9c-4e89-9a27-a48f4e69b02a ", // trailing space
  ];
  for (const id of invalid) {
    assert.equal(isUuid(id), false, `Expected invalid UUID: ${id}`);
  }
});

test("customerUuid: uses isUuid, rejects invalid with CustomerError, returns lowercase", () => {
  const upper = "C9B84172-5B9C-4E89-9A27-A48F4E69B02A";
  assert.equal(customerUuid(upper), upper.toLowerCase());

  assert.throws(
    () => customerUuid("invalid-uuid"),
    (err) => {
      return err instanceof CustomerError && err.code === "VALIDATION_ERROR";
    },
  );
  assert.throws(
    () => customerUuid(null),
    (err) => {
      return err instanceof CustomerError && err.code === "VALIDATION_ERROR";
    },
  );
});

test("isLowercaseHex64: validates exact 64-char lowercase hex strings without implicit trimming", () => {
  const valid =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  assert.equal(isLowercaseHex64(valid), true);

  const invalid = [
    "",
    null,
    undefined,
    123,
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde", // 63 chars
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0", // 65 chars
    "0123456789ABCDEF0123456789abcdef0123456789abcdef0123456789abcdef", // uppercase
    " " + valid, // leading space
    valid + " ", // trailing space
    "g".repeat(64), // non-hex
  ];
  for (const item of invalid) {
    assert.equal(
      isLowercaseHex64(item),
      false,
      `Expected invalid hex64: ${item}`,
    );
  }
});

test("PhoneNumber: parses VN national and international E.164 formats, rejects extensions and invalid", () => {
  const vnPhone = PhoneNumber.parse("0912345678", "VN");
  assert.equal(vnPhone.value, "+84912345678");
  assert.equal(vnPhone.toString(), "+84912345678");
  assert.ok(Object.isFrozen(vnPhone));

  const intlPhone = PhoneNumber.parse("+1 202 555 0123");
  assert.equal(intlPhone.value, "+12025550123");

  // Equality
  const vnPhone2 = PhoneNumber.parse("+84912345678");
  assert.equal(vnPhone.equals(vnPhone2), true);
  assert.equal(vnPhone.equals(intlPhone), false);
  assert.equal(vnPhone.equals(null), false);
  assert.equal(vnPhone.equals({ value: "+84912345678" }), false);

  // Whitespace trimming
  const padded = PhoneNumber.parse("  0912345678  ", "VN");
  assert.equal(padded.value, "+84912345678");

  // Rejections
  const invalidInputs = [
    "invalid",
    "0912345678 ext 100", // extension rejected
    "+12025550199999999999999999999999999999999999999999999999999999999999999999",
    "",
    "   ",
    null,
    undefined,
    123456789,
  ];
  for (const input of invalidInputs) {
    assert.throws(
      () => PhoneNumber.parse(input, "VN"),
      (err) => err instanceof InvalidPhoneNumberError,
      `Expected InvalidPhoneNumberError for: ${input}`,
    );
  }
});

test("CountryCode: validates ISO 3166-1 alpha-2, uppercases, excludes XK", () => {
  const vn = CountryCode.parse("vn");
  assert.equal(vn.value, "VN");
  assert.equal(vn.toString(), "VN");
  assert.ok(Object.isFrozen(vn));

  const us = CountryCode.parse(" us ");
  assert.equal(us.value, "US");

  // Equality
  const vn2 = CountryCode.parse("VN");
  assert.equal(vn.equals(vn2), true);
  assert.equal(vn.equals(us), false);
  assert.equal(vn.equals(null), false);

  // Rejections
  const invalidCodes = [
    "XK", // excluded
    "xk",
    "USA", // 3 letters
    "V", // 1 letter
    "12", // numbers
    "ZZ", // invalid ISO
    "",
    "   ",
    null,
    undefined,
    {},
  ];
  for (const code of invalidCodes) {
    assert.throws(
      () => CountryCode.parse(code),
      (err) => err instanceof InvalidCountryCodeError,
      `Expected InvalidCountryCodeError for: ${code}`,
    );
  }
});

const {
  parseCustomerPhone,
  parseCustomerCountryCode,
} = require("../dist/customer/domain/customer.value-objects");

test("Customer pure VO policy functions: parseCustomerPhone and parseCustomerCountryCode", () => {
  // Valid VN phone via pure domain function
  const phoneVn = parseCustomerPhone("0912345678");
  assert.equal(phoneVn.value, "+84912345678");

  // Valid international phone
  const phoneIntl = parseCustomerPhone("+1 202 555 0123");
  assert.equal(phoneIntl.value, "+12025550123");

  // CountryCode normalization via pure domain function
  const codeVn = parseCustomerCountryCode("vn");
  assert.equal(codeVn.value, "VN");
  const codeUs = parseCustomerCountryCode(" US ");
  assert.equal(codeUs.value, "US");

  // Rejections map directly to CustomerError("VALIDATION_ERROR")
  const invalidPhones = [
    "",
    "   ",
    null,
    undefined,
    12345,
    "not-a-phone",
    "x".repeat(65), // exceeds Customer raw max length of 64
    "0912345678 ext 123", // extension rejected
  ];
  for (const p of invalidPhones) {
    assert.throws(
      () => parseCustomerPhone(p),
      (err) => err instanceof CustomerError && err.code === "VALIDATION_ERROR",
      `Expected CustomerError("VALIDATION_ERROR") for phone: ${p}`,
    );
  }

  const invalidCodes = [
    "",
    "   ",
    null,
    undefined,
    "XK", // XK excluded
    "USA", // 3 chars
    "ZZ", // invalid ISO
    12,
  ];
  for (const c of invalidCodes) {
    assert.throws(
      () => parseCustomerCountryCode(c),
      (err) => err instanceof CustomerError && err.code === "VALIDATION_ERROR",
      `Expected CustomerError("VALIDATION_ERROR") for country: ${c}`,
    );
  }
});

const fs = require("node:fs");
const path = require("node:path");

test("OpenAPI schema: Customer pagination parameters are integer and phone fields have minLength 1", () => {
  const openApiContent = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../openapi/openapi.json"), "utf8"),
  );

  // Check /api/customers GET parameters
  const listParams = openApiContent.paths["/api/customers"].get.parameters;
  const pageParam = listParams.find((p) => p.name === "page");
  const pageSizeParam = listParams.find((p) => p.name === "pageSize");
  const phoneParam = listParams.find((p) => p.name === "phone");

  assert.ok(pageParam, "Query parameter 'page' must exist");
  assert.equal(pageParam.schema.type, "integer");
  assert.equal(pageParam.schema.minimum, 1);
  assert.equal(pageParam.schema.default, 1);

  assert.ok(pageSizeParam, "Query parameter 'pageSize' must exist");
  assert.equal(pageSizeParam.schema.type, "integer");
  assert.equal(pageSizeParam.schema.minimum, 1);
  assert.equal(pageSizeParam.schema.maximum, 100);
  assert.equal(pageSizeParam.schema.default, 20);

  assert.ok(phoneParam, "Query parameter 'phone' must exist");
  assert.equal(phoneParam.schema.minLength, 1);
  assert.equal(phoneParam.schema.maxLength, 64);

  // No duplicate query parameters
  const paramNames = listParams.map((p) => p.name);
  assert.equal(
    new Set(paramNames).size,
    paramNames.length,
    "Query parameters must have unique names",
  );

  // Check CreateCustomerDto
  const createSchema = openApiContent.components.schemas.CreateCustomerDto;
  assert.equal(createSchema.properties.phone.minLength, 1);
  assert.equal(createSchema.properties.phone.maxLength, 64);

  // Check AddressInputDto
  const addressSchema = openApiContent.components.schemas.AddressInputDto;
  assert.equal(addressSchema.properties.recipientPhone.minLength, 1);
  assert.equal(addressSchema.properties.recipientPhone.maxLength, 64);

  // Check PatchCustomerDto inherits minLength: 1
  const patchSchema = openApiContent.components.schemas.PatchCustomerDto;
  assert.equal(patchSchema.properties.phone.minLength, 1);
});
