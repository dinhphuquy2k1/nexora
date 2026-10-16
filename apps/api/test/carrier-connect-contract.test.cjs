require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const {
  CarrierLifecycleController,
} = require("../dist/carrier/presentation/carrier-lifecycle.controller");
const contract = require("../openapi/openapi.json");
test("Uniship conditional identifier matches strict runtime validation and documented current schema", async () => {
  let calls = 0;
  const controller = new CarrierLifecycleController({
    connect: async () => {
      calls++;
      return { id: randomUUID() };
    },
  });
  const req = { user: { id: randomUUID() } },
    res = { setHeader() {}, locals: { requestId: randomUUID() } };
  const valid = {
    provider: "uniship",
    loginIdentifier: " branch ",
    password: "synthetic",
    displayName: "Branch",
  };
  const { loginIdentifier, ...missing } = valid;
  assert.ok(loginIdentifier);
  for (const input of [
    missing,
    { ...valid, loginIdentifier: "" },
    { ...valid, loginIdentifier: " " },
    { ...valid, loginIdentifier: null },
    { ...valid, loginIdentifier: "a".repeat(129) },
    { ...valid, provider: "unknown" },
    { ...valid, userId: randomUUID() },
  ]) {
    await assert.rejects(
      controller.connect(req, input, res),
      (e) =>
        e.getStatus?.() === 400 &&
        e.getResponse?.().code === "VALIDATION_ERROR",
    );
  }
  assert.equal(calls, 0);
  await controller.connect(req, valid, res);
  assert.equal(calls, 1);
  const schema = contract.components.schemas.ConnectCarrierDto;
  assert.ok(schema.required.includes("loginIdentifier"));
  assert.equal(schema.properties.loginIdentifier.maxLength, 128);
  assert.match(schema.properties.loginIdentifier.description, /Uniship/);
  assert.equal(
    contract.components.schemas.CarrierConnectionDto.properties.loginIdentifier
      .nullable,
    true,
  );
});
