import { URLSearchParams } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCustomerQuery,
  customerQueryString,
} from "../features/customers/query.ts";
import {
  createCustomerPayload,
  patchCustomerPayload,
  addressPayload,
} from "../features/customers/payload.ts";
import { customerStats } from "../features/customers/response.ts";
import { CustomerReadLane } from "../features/customers/request.ts";
import { deleteCustomerAddress } from "../features/customers/address-actions.ts";

test("URL parsing is bounded, omits blank search and never broadens invalid queries", () => {
  assert.deepEqual(parseCustomerQuery(new URLSearchParams("q=  &x=secret")), {
    page: 1,
    pageSize: 20,
  });
  for (const q of [
    "page=0",
    "pageSize=101",
    "page=2147483647&pageSize=100",
    "status=ALL",
    "q=a&q=b",
    "phone=",
    "q=" + "x".repeat(201),
  ])
    assert.throws(() => parseCustomerQuery(new URLSearchParams(q)));
  assert.equal(
    customerQueryString({
      page: 1,
      pageSize: 20,
      q: "  Lan  ",
      status: "ACTIVE",
    }),
    "page=1&pageSize=20&q=Lan&status=ACTIVE",
  );
  assert.equal(
    parseCustomerQuery(
      new URLSearchParams("page=2&pageSize=100&phone=%2B84912345678"),
    ).phone,
    "+84912345678",
  );
});
test("create/patch allowlists preserve fallback, nullable clears, exact bounds and required address", () => {
  for (const n of [1, 100, 101, 200])
    for (const a of [1, 255, 256, 2000]) {
      const p = createCustomerPayload(
        {
          name: "N".repeat(n),
          phone: "0".repeat(64),
          email: "",
          note: "",
          owner: "forged",
        },
        {
          addressText: "A".repeat(a),
          countryCode: "VN",
          recipientName: "",
          recipientPhone: "",
          label: "",
          isDefault: true,
        },
      );
      assert.deepEqual(Object.keys(p), ["name", "phone", "address"]);
      assert.deepEqual(Object.keys(p.address), ["countryCode", "addressText"]);
    }
  assert.throws(() =>
    createCustomerPayload({ name: "N", phone: "123" }, { addressText: "" }),
  );
  assert.throws(() =>
    createCustomerPayload(
      { name: "N".repeat(201), phone: "123" },
      { addressText: "A" },
    ),
  );
  assert.deepEqual(
    patchCustomerPayload(
      { name: "N", phone: "123", email: "", note: "", status: "ACTIVE" },
      {
        name: "N",
        phone: "123",
        email: "a@b.co",
        note: "old",
        status: "ACTIVE",
      },
    ),
    { email: null, note: null },
  );
  assert.throws(() =>
    patchCustomerPayload(
      { name: "N", phone: "123", email: "", note: "", status: "ACTIVE" },
      { name: "N", phone: "123", email: null, note: null, status: "ACTIVE" },
    ),
  );
  assert.deepEqual(
    addressPayload(
      {
        label: "",
        recipientName: "N",
        recipientPhone: "123",
        countryCode: "VN",
        addressText: "new",
      },
      {
        label: "old",
        recipientName: "N",
        recipientPhone: "123",
        countryCode: "VN",
        addressText: "old",
      },
    ),
    { label: null, addressText: "new", countryCode: "VN" },
  );
});
test("stats distinguish successful zero from missing/malformed contract", () => {
  assert.deepEqual(customerStats({ total: 0, active: 0, inactive: 0 }), {
    total: 0,
    active: 0,
    inactive: 0,
  });
  for (const x of [
    undefined,
    null,
    {},
    { total: 1, active: 0, inactive: 0 },
    { total: -1, active: 0, inactive: -1 },
    { total: 1, active: 0.5, inactive: 0.5 },
  ])
    assert.equal(customerStats(x), null);
});
test("generation invalidates immediately during debounce, stale data/error/finally and unmount cannot commit", () => {
  const lane = new CustomerReadLane();
  const a = lane.begin("A");
  lane.invalidate();
  assert.equal(lane.current(a), false);
  const b = lane.begin("B");
  assert.equal(lane.current(a), false);
  assert.equal(lane.current(b), true);
  assert.equal(a.signal.aborted, true);
  lane.invalidate();
  assert.equal(lane.current(b), false);
  const retry = lane.begin("B");
  assert.equal(lane.current(b), false);
  assert.equal(lane.current(retry), true);
  lane.dispose();
  assert.equal(lane.current(retry), false);
});
test("default deletion is explicitly sequential; PUT failure never deletes; partial DELETE never rolls back", async () => {
  const target = { id: "a", isDefault: true };
  const calls = [];
  let phase = "put";
  const api = {
    setDefault: async () => {
      calls.push("put");
      if (phase === "put") throw Error("put");
    },
    remove: async () => {
      calls.push("delete");
      throw Error("delete");
    },
  };
  const first = await deleteCustomerAddress(api, "c", target, 2, "b");
  assert.equal(first.kind, "failed");
  assert.deepEqual(calls, ["put"]);
  phase = "delete";
  calls.length = 0;
  const second = await deleteCustomerAddress(api, "c", target, 2, "b");
  assert.equal(second.kind, "partial");
  assert.deepEqual(calls, ["put", "delete"]);
  assert.equal(
    (await deleteCustomerAddress(api, "c", target, 1, "b")).kind,
    "last",
  );
});

test("error status authority separates forbidden/session/phone and never renders server text", async () => {
  const { CustomerApiError, customerError } = await import(
    "../features/customers/errors.ts"
  );
  assert.equal(
    customerError(new CustomerApiError(403, { message: "PII" }))
      .unauthenticated,
    undefined,
  );
  assert.equal(
    customerError(new CustomerApiError(401, {})).unauthenticated,
    true,
  );
  assert.equal(
    customerError(new CustomerApiError(409, { code: "CUSTOMER_PHONE_EXISTS" }))
      .field,
    "phone",
  );
  assert.equal(
    customerError(
      new CustomerApiError(500, { message: "PII" }),
    ).message.includes("PII"),
    false,
  );
});
