const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assessScanFacts,
  validateScanPage,
  scanScopeFingerprint,
} = require("../../dist/sync/infrastructure/sync-scan-observation");
const contract = {
  sourceKeyScheme: "uniship-parcel-v1",
  pageSize: 100,
  scope: "UNISHIP_ECOMMERCE_V1",
};
const job = {
  owner_user_id: "00000000-0000-4000-8000-000000000001",
  provider: "uniship",
  external_account_id: "synthetic",
  sync_type: "SHIPMENT",
  fetch_strategy: "FULL",
  next_page: 1,
  next_cursor: null,
  target_watermark: null,
};
const facts = {
  pages: 3,
  first: 1,
  last: 3,
  totalVariants: 1,
  reportedTotal: 205,
  observations: 205,
  observedCount: 205,
  scopeMismatches: 0,
};
test("complete scan assessment has deterministic safe outcomes, independent from ingestion", () => {
  assert.deepEqual(assessScanFacts(facts, true, 3), {
    status: "VALIDATED",
    reason: null,
    observedCount: 205,
    reportedTotal: 205,
  });
  for (const [change, meta, last, status, reason] of [
    [{}, false, 3, "INCOMPLETE", "MISSING_SCAN_METADATA"],
    [{ scopeMismatches: 1 }, true, 3, "UNTRUSTED", "SCOPE_MISMATCH"],
    [{ totalVariants: 2 }, true, 3, "UNTRUSTED", "TOTAL_MISMATCH"],
    [{ observedCount: 204 }, true, 3, "UNTRUSTED", "DUPLICATE_IDENTITY"],
    [{ pages: 2 }, true, 3, "INCOMPLETE", "PAGE_GAP"],
    [{}, true, null, "INCOMPLETE", "MISSING_TERMINAL_PAGE"],
    [
      { observations: 204, observedCount: 204 },
      true,
      3,
      "UNTRUSTED",
      "COUNT_MISMATCH",
    ],
    [
      {
        pages: 0,
        first: null,
        last: null,
        totalVariants: 0,
        reportedTotal: null,
        observations: 0,
        observedCount: 0,
      },
      true,
      null,
      "INCOMPLETE",
      "MISSING_SCAN_METADATA",
    ],
  ]) {
    const out = assessScanFacts({ ...facts, ...change }, meta, last);
    assert.equal(out.status, status);
    assert.equal(out.reason, reason);
    assert.ok(!JSON.stringify(out).includes("synthetic"));
  }
  assert.equal(
    assessScanFacts(
      {
        ...facts,
        pages: 1,
        last: 1,
        reportedTotal: 0,
        observations: 0,
        observedCount: 0,
      },
      true,
      1,
    ).status,
    "VALIDATED",
  );
});
test("observation metadata is exact, bounded and tied to the current full scan", () => {
  const page = {
    records: [],
    done: true,
    scan: { pageNumber: 1, pageSize: 100, reportedTotal: 0, ...contract },
  };
  assert.doesNotThrow(() => validateScanPage(contract, job, page));
  for (const mutate of [
    (p) => delete p.scan,
    (p) => (p.scan.reportedTotal = "0"),
    (p) => (p.scan.reportedTotal = -1),
    (p) => (p.scan.reportedTotal = 2147483648),
    (p) => (p.scan.pageNumber = 2),
    (p) => (p.scan.pageSize = 500),
    (p) => (p.scan.scope = "other"),
    (p) => (p.scan.sourceKeyScheme = "other-v1"),
    (p) => (p.scan.token = "must-not-persist"),
    (p) => (p.done = false),
    (p) => (p.nextCursor = "forbidden"),
    (p) => (p.watermark = "forbidden"),
  ]) {
    const p = globalThis.structuredClone(page);
    mutate(p);
    assert.throws(
      () => validateScanPage(contract, job, p),
      (e) => e.code === "SOURCE_INVALID",
    );
  }
  const next = { ...job, next_page: 2 };
  assert.throws(
    () =>
      validateScanPage(contract, next, {
        ...page,
        scan: { ...page.scan, pageNumber: 2 },
      }),
    (e) => e.code === "SOURCE_INVALID",
  );
  assert.equal(scanScopeFingerprint(job, contract).length, 64);
  for (const change of [
    { owner_user_id: "other" },
    { external_account_id: "other" },
    { provider: "other" },
    { sync_type: "CUSTOMER" },
  ])
    assert.notEqual(
      scanScopeFingerprint({ ...job, ...change }, contract),
      scanScopeFingerprint(job, contract),
    );
  assert.notEqual(
    scanScopeFingerprint(job, { ...contract, scope: "OTHER" }),
    scanScopeFingerprint(job, contract),
  );
});

test("actual Uniship opt-in is immutable in the registry; legacy providers stay unobserved", () => {
  const {
    SyncCapabilityRegistry,
  } = require("../../dist/sync/infrastructure/sync-capability.registry");
  const {
    UnishipShipmentProvider,
  } = require("../../dist/shipment/infrastructure/uniship/uniship-shipment.provider");
  const actual = new UnishipShipmentProvider({}, {}, {});
  assert.equal(actual.fullScan.sourceKeyScheme, "uniship-parcel-v1");
  assert.equal(actual.fullScan.pageSize, 100);
  assert.equal(actual.fullScan.scope.length, 64);
  assert.equal(Object.isFrozen(actual.fullScan), true);
  const provider = {
    strategy: () => "FULL",
    fetch: async () => {},
    fullScan: { ...contract },
  };
  const domain = { version: 1, supports: () => true };
  const registry = new SyncCapabilityRegistry([
    { providerName: "uniship", type: "SHIPMENT", provider, domain },
  ]);
  provider.fullScan.scope = "changed";
  assert.equal(
    registry.resolve("uniship", "SHIPMENT").fullScan.scope,
    contract.scope,
  );
  assert.equal(
    Object.isFrozen(registry.resolve("uniship", "SHIPMENT").fullScan),
    true,
  );
  for (const change of [
    { providerName: "other" },
    { type: "CUSTOMER" },
    { provider: { ...provider, fullScan: { ...contract, pageSize: 500 } } },
  ])
    assert.throws(
      () =>
        new SyncCapabilityRegistry([
          {
            providerName: "uniship",
            type: "SHIPMENT",
            provider,
            domain,
            ...change,
          },
        ]),
    );
  const legacy = new SyncCapabilityRegistry([
    {
      providerName: "uniship",
      type: "SHIPMENT",
      provider: { strategy: () => "FULL", fetch: async () => {} },
      domain,
    },
  ]);
  assert.equal(legacy.resolve("uniship", "SHIPMENT").fullScan, undefined);
});

test("scope fingerprint permits only bounded UTF-8 metadata, never unbounded hashing under locks", () => {
  assert.equal(
    scanScopeFingerprint(
      { ...job, external_account_id: "😀".repeat(128) },
      contract,
    ).length,
    64,
  );
  for (const external_account_id of ["a".repeat(2048), "đ".repeat(1400)])
    assert.throws(
      () => scanScopeFingerprint({ ...job, external_account_id }, contract),
      (e) => e.code === "SOURCE_INVALID",
    );
});

test("Uniship canonical query semantics bind scope while page position does not", () => {
  const {
    defineUnishipFullScan,
    UNISHIP_SCAN_DEFINITION,
    UNISHIP_SCAN,
  } = require("../../dist/shipment/infrastructure/uniship/uniship-full-scan");
  const definition = {
    endpoint: "/client/api/transition/",
    ecommerce: "true",
    filters: [{ column: "IsEcommerce", value: 1, condition: "equal" }],
    q: "",
    pageSize: 100,
    sourceKeyScheme: "uniship-parcel-v1",
    strategy: "FULL",
    version: "UNISHIP_ECOMMERCE_V1",
  };
  const scan = defineUnishipFullScan(definition);
  assert.deepEqual(UNISHIP_SCAN_DEFINITION, definition);
  assert.deepEqual(UNISHIP_SCAN.contract, scan.contract);
  assert.equal(scan.contract.scope.length, 64);
  const base = scanScopeFingerprint(job, scan.contract);
  for (const change of [
    { filters: [{ column: "IsEcommerce", value: 0, condition: "equal" }] },
    { filters: [{ column: "IsEcommerce", value: 1, condition: "not_equal" }] },
    {
      filters: [
        ...definition.filters,
        { column: "SoftDeleted", value: 0, condition: "equal" },
      ],
    },
    { filters: [{ column: "OtherColumn", value: 1, condition: "equal" }] },
    { version: "UNISHIP_ECOMMERCE_V2" },
    { q: "other" },
    { ecommerce: "false" },
    { endpoint: "/client/api/other/" },
    { pageSize: 50 },
    { sourceKeyScheme: "other-v1" },
    { strategy: "INCREMENTAL" },
  ]) {
    const alternate = defineUnishipFullScan({ ...definition, ...change });
    assert.notEqual(scanScopeFingerprint(job, alternate.contract), base);
  }
  for (const change of [
    { owner_user_id: "other" },
    { provider: "other" },
    { external_account_id: "other" },
    { sync_type: "CUSTOMER" },
  ])
    assert.notEqual(
      scanScopeFingerprint({ ...job, ...change }, scan.contract),
      base,
    );
  const first = scan.request(1),
    second = scan.request(2);
  assert.equal(first.endpoint, "/client/api/transition/");
  assert.equal(first.query.get("page"), "1");
  assert.equal(second.query.get("page"), "2");
  const firstScopeQuery = new globalThis.URLSearchParams(first.query);
  firstScopeQuery.delete("page");
  const secondScopeQuery = new globalThis.URLSearchParams(second.query);
  secondScopeQuery.delete("page");
  assert.equal(firstScopeQuery.toString(), secondScopeQuery.toString());
  assert.equal(
    scanScopeFingerprint({ ...job, next_page: 2 }, scan.contract),
    base,
  );
  first.query.set("q", "caller mutation");
  definition.filters[0].value = 0;
  assert.equal(scan.request(1).query.get("q"), "");
  assert.deepEqual(
    JSON.parse(Buffer.from(scan.request(1).query.get("filter"), "base64")),
    {
      filter: [{ column: "IsEcommerce", value: 1, condition: "equal" }],
    },
  );
  assert.equal(scanScopeFingerprint(job, scan.contract), base);
  for (const value of [
    scan,
    scan.definition,
    scan.definition.filters,
    scan.definition.filters[0],
    scan.contract,
  ])
    assert.equal(Object.isFrozen(value), true);
});
