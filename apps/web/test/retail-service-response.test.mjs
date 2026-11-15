import test from "node:test";
import assert from "node:assert/strict";
import {
  ShipmentServiceCode as S,
  LogisticsStage,
} from "@nexora/shared/shipment";
import {
  readShipment,
  readShipmentPage,
} from "../features/retail-packages/response.ts";
import { REFERENCE_DETAILS, asSummary } from "./fixtures/retail-packages.ts";

const fields = [
  [S.INSURANCE, "insurance"],
  [S.COUNTING, "counting"],
  [S.FRAGILE_GOODS, "fragileGoods"],
  [S.FOAM, "foam"],
];
const entry = (serviceCode, enabled = true, index = 1) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  serviceCode,
  enabled,
});
function detail(services = [], summary = {}) {
  return {
    ...globalThis.structuredClone(REFERENCE_DETAILS[0]),
    services,
    serviceSummary: {
      insurance: null,
      counting: null,
      fragileGoods: null,
      foam: null,
      ...summary,
    },
  };
}
const accept = (shipment) =>
  assert.deepEqual(readShipment({ shipment }), shipment);
const reject = (shipment) =>
  assert.throws(() => readShipment({ shipment }), /MALFORMED_RESPONSE/);

for (const [code, field] of fields) {
  for (const [name, services, value, valid] of [
    ["enabled", [entry(code, true)], true, true],
    ["disabled", [entry(code, false)], false, true],
    ["missing unknown", [], null, true],
    ["enabled versus false", [entry(code, true)], false, false],
    ["disabled versus true", [entry(code, false)], true, false],
    ["missing versus false", [], false, false],
    ["missing versus true", [], true, false],
    ["enabled versus unknown", [entry(code, true)], null, false],
    ["disabled versus unknown", [entry(code, false)], null, false],
  ]) {
    test(`P2-A ${code}: ${name}`, () => {
      const shipment = detail(services, { [field]: value });
      // Opposing fee flags must not affect acceptance or manufacture service facts.
      shipment.chargeSummary.hasInsurance = value !== true;
      shipment.chargeSummary.hasCounting = value !== true;
      shipment.chargeSummary.hasWoodPacking = value !== true;
      shipment.chargeSummary.hasBubbleWrap = value !== true;
      (valid ? accept : reject)(shipment);
    });
  }
}

test("P2-A multiple matching facts and an empty unknown snapshot are accepted", () => {
  accept(detail());
  accept(
    detail([entry(S.INSURANCE, false), entry(S.FOAM, true, 2)], {
      insurance: false,
      foam: true,
    }),
  );
});
for (const [, field] of fields) {
  test(`P2-A multiple facts reject one contradictory ${field}`, () => {
    reject(
      detail(
        fields.map(([code], index) => entry(code, true, index + 1)),
        {
          insurance: true,
          counting: true,
          fragileGoods: true,
          foam: true,
          [field]: false,
        },
      ),
    );
  });
}

test("P2-A list guard accepts service summaries without a detail collection", () => {
  const shipment = detail([], { insurance: true, counting: false });
  const summary = asSummary(shipment);
  const page = {
    shipments: [summary],
    pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    stats: {
      total: 1,
      claims: null,
      byStage: Object.fromEntries(
        Object.values(LogisticsStage).map((code) => [
          code,
          code === summary.logisticsStage ? 1 : 0,
        ]),
      ),
    },
    claimFilterAvailable: false,
  };
  assert.deepEqual(readShipmentPage(page), page);
});

for (const id of [
  "00000000-0000-4000-8000-000000000001",
  "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF",
]) {
  test(`P2-B valid UUID ${id} remains accepted`, () => {
    accept(
      detail([{ ...entry(S.INSURANCE, false), id }], { insurance: false }),
    );
  });
}
for (const [name, id] of [
  ["invalid", "service"],
  ["empty", ""],
  ["numeric", 1],
  ["null", null],
  ["missing", undefined],
  ["padded", " 00000000-0000-4000-8000-000000000001"],
  ["nonhex", "zzzzzzzz-0000-4000-8000-000000000001"],
]) {
  test(`P2-B rejects ${name} service UUID`, () => {
    reject(
      detail([{ ...entry(S.INSURANCE, false), id }], { insurance: false }),
    );
  });
}
for (let mask = 0; mask < 16; mask++) {
  test(`P2-B canonical subset ${mask} including empty and disabled facts is accepted`, () => {
    const subset = fields.filter((_, index) => mask & (1 << index));
    accept(
      detail(
        subset.map(([code], index) => entry(code, false, index + 1)),
        Object.fromEntries(subset.map(([, field]) => [field, false])),
      ),
    );
  });
}
test("P2-B rejects duplicate and invalid service codes", () => {
  reject(
    detail([entry(S.FOAM, false), entry(S.FOAM, false, 2)], { foam: false }),
  );
  reject(detail([entry("WOOD_PACKING", false)]));
});
for (let index = 0; index < 3; index++) {
  test(`P2-B rejects reversed canonical neighbours ${index}`, () => {
    const services = fields.map(([code], i) => entry(code, true, i + 1));
    [services[index], services[index + 1]] = [
      services[index + 1],
      services[index],
    ];
    reject(
      detail(services, {
        insurance: true,
        counting: true,
        fragileGoods: true,
        foam: true,
      }),
    );
  });
}
test("P2-B rejects an unordered partial collection", () => {
  reject(
    detail([entry(S.FOAM, false), entry(S.INSURANCE, true, 2)], {
      insurance: true,
      foam: false,
    }),
  );
});
