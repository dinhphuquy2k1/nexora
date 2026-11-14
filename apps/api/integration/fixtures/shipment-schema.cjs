const assert = require("node:assert/strict");
const {
  LogisticsStage,
  ShipmentKind,
  ShipmentChargeCode,
  ShipmentMilestoneCode,
} = require("@nexora/shared/shipment");
const contracts = [
  [
    "shipment_milestones",
    "chk_shipment_milestones_code",
    "milestone_code",
    Object.values(ShipmentMilestoneCode),
  ],
  [
    "shipments",
    "chk_shipments_kind",
    "shipment_kind",
    Object.values(ShipmentKind),
  ],
  [
    "shipments",
    "chk_shipments_stage",
    "logistics_stage",
    Object.values(LogisticsStage),
  ],
  [
    "shipment_charges",
    "chk_shipment_charges_code",
    "charge_code",
    Object.values(ShipmentChargeCode),
  ],
  [
    "shipment_stage_history",
    "chk_shipment_history_to",
    "to_stage",
    Object.values(LogisticsStage),
  ],
  [
    "shipment_stage_history",
    "chk_shipment_history_from",
    "from_stage",
    Object.values(LogisticsStage),
    true,
  ],
];
async function assertVocabulary(db) {
  for (const [table, name, column, values, nullable] of contracts) {
    const rows = await db.$queryRawUnsafe(
      `SELECT c.convalidated,c.conkey,array_agg(a.attname::text ORDER BY a.attname) AS columns,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=ANY(c.conkey) WHERE n.nspname='public' AND t.relname=$1 AND c.conname=$2 AND c.contype='c' GROUP BY c.oid,c.convalidated,c.conkey`,
      table,
      name,
    );
    assert.equal(rows.length, 1, name);
    const c = rows[0];
    assert.equal(c.convalidated, true, name);
    assert.deepEqual(c.columns, [column], name + " exact conkey");
    let normalized = c.definition
      .replace(/::(?:text|character varying)(?:\[\])?/g, "")
      .replace(/[()\s]/g, "")
      .replace(/^CHECK/, "");
    if (nullable) {
      const prefix = column + "ISNULLOR";
      assert.ok(
        normalized.startsWith(prefix),
        name + " nullable membership only",
      );
      normalized = normalized.slice(prefix.length);
    }
    const prefix = column + "=";
    assert.ok(normalized.startsWith(prefix), name + " correct column");
    const expression = normalized.slice(prefix.length);
    let actual;
    if (expression.startsWith("ANYARRAY[") && expression.endsWith("]")) {
      const literals = expression.slice(9, -1);
      assert.match(literals, /^'[A-Z_]+'(?:,'[A-Z_]+')*$/);
      actual = literals.split(",").map((x) => x.slice(1, -1));
    } else {
      assert.match(expression, /^'[A-Z_]+'$/);
      actual = [expression.slice(1, -1)];
    }
    assert.deepEqual(
      actual.sort(),
      [...values].sort(),
      name + " exact allowed set",
    );
  }
}
async function assertItemValues(db) {
  for (const [name, columns, definition] of [
    [
      "chk_shipment_items_value_pair",
      ["currency", "unit_value"],
      "unit_valueISNULL=currencyISNULL",
    ],
    [
      "chk_shipment_items_value_finite",
      ["unit_value"],
      "unit_valueISNULLORunit_value<>'NaN'",
    ],
    [
      "chk_shipment_items_value_nonneg",
      ["unit_value"],
      "unit_valueISNULLORunit_value>=0",
    ],
    [
      "chk_shipment_items_currency",
      ["currency"],
      "currencyISNULLORcurrency~'^[A-Z]{3}$'",
    ],
  ]) {
    const catalog = await db.$queryRawUnsafe(
      `SELECT pg_get_constraintdef(c.oid) AS definition,c.convalidated, array_agg(a.attname::text ORDER BY a.attname) AS columns FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.conrelid='shipment_items'::regclass AND c.conname=$1 AND c.contype='c' GROUP BY c.oid,c.convalidated`,
      name,
    );
    assert.equal(catalog.length, 1, name);
    assert.equal(catalog[0].convalidated, true, name);
    assert.deepEqual(catalog[0].columns, columns, name);
    assert.equal(
      catalog[0].definition
        .replace(/::(?:text|numeric|bpchar)/g, "")
        .replace(/[()\s]/g, "")
        .replace(/^CHECK/, ""),
      definition,
      name + " exact expression",
    );
  }
}
module.exports.verifyShipmentSchema = async (db) => {
  await assertVocabulary(db);
  // Real catalog mutations, rolled back by the failing oracle, not list self-comparison.
  for (const mutation of [
    "ALTER TABLE shipments DROP CONSTRAINT chk_shipments_stage; ALTER TABLE shipments ADD CONSTRAINT chk_shipments_stage CHECK(logistics_stage IN ('UNKNOWN') OR true)",
    "ALTER TABLE shipment_milestones DROP CONSTRAINT chk_shipment_milestones_code; ALTER TABLE shipment_milestones ADD CONSTRAINT chk_shipment_milestones_code CHECK(milestone_code IN ('ORIGIN_RECEIVED') OR true)",
    "ALTER TABLE shipment_milestones DROP CONSTRAINT chk_shipment_milestones_code; ALTER TABLE shipment_milestones ADD CONSTRAINT chk_shipment_milestones_code CHECK(milestone_code IN ('ORIGIN_RECEIVED','ORIGIN_DISPATCHED','DEST_RECEIVED','DEST_DISPATCHED')) NOT VALID",
    "ALTER TABLE shipment_milestones DROP CONSTRAINT chk_shipment_milestones_code; ALTER TABLE shipment_milestones ADD CONSTRAINT chk_shipment_milestones_code CHECK(provider_label IN ('ORIGIN_RECEIVED','ORIGIN_DISPATCHED','DEST_RECEIVED','DEST_DISPATCHED'))",
    "ALTER TABLE shipments DROP CONSTRAINT chk_shipments_stage; ALTER TABLE shipments ADD CONSTRAINT chk_shipments_stage CHECK(logistics_stage IN ('TO_ORIGIN_WAREHOUSE','AT_ORIGIN_WAREHOUSE','TO_DEST_WAREHOUSE','AT_DEST_WAREHOUSE','DELIVERED','UNKNOWN')) NOT VALID",
    "ALTER TABLE shipments DROP CONSTRAINT chk_shipments_stage; ALTER TABLE shipments ADD CONSTRAINT chk_shipments_stage CHECK(provider_status IN ('TO_ORIGIN_WAREHOUSE','AT_ORIGIN_WAREHOUSE','TO_DEST_WAREHOUSE','AT_DEST_WAREHOUSE','DELIVERED','UNKNOWN'))",
  ]) {
    await assert.rejects(
      db.$transaction(async (tx) => {
        for (const sql of mutation.split(";").filter(Boolean))
          await tx.$executeRawUnsafe(sql);
        await assertVocabulary(tx);
      }),
      (e) => e instanceof assert.AssertionError,
    );
    await assertVocabulary(db);
  }
  await assertItemValues(db);
  for (const name of [
    "chk_shipment_items_value_pair",
    "chk_shipment_items_value_finite",
    "chk_shipment_items_value_nonneg",
    "chk_shipment_items_currency",
  ]) {
    for (const suffix of ["", " NOT VALID"]) {
      await assert.rejects(
        db.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `ALTER TABLE shipment_items DROP CONSTRAINT ${name}`,
          );
          await tx.$executeRawUnsafe(
            `ALTER TABLE shipment_items ADD CONSTRAINT ${name} CHECK(unit_value IS NULL OR true)${suffix}`,
          );
          await assertItemValues(tx);
        }),
        (e) => e instanceof assert.AssertionError,
      );
      await assertItemValues(db);
    }
  }
  const u = await db.user.create({
    data: {
      username: "schema-" + require("node:crypto").randomUUID(),
      role: "OPERATOR",
    },
  });
  const a = await db.$queryRawUnsafe(
    `INSERT INTO shipments(owner_user_id,tracking_code) VALUES($1::uuid,'same') RETURNING *`,
    u.id,
  );
  const b = await db.$queryRawUnsafe(
    `INSERT INTO shipments(owner_user_id,tracking_code) VALUES($1::uuid,'same') RETURNING *`,
    u.id,
  );
  assert.notEqual(a[0].id, b[0].id);
  assert.match(a[0].code, /^SHP\d{6,}$/);
  assert.equal(a[0].customer_id, null);
  for (const stage of Object.values(LogisticsStage))
    await db.$executeRawUnsafe(
      `UPDATE shipments SET logistics_stage=$1 WHERE id=$2::uuid`,
      stage,
      a[0].id,
    );
  for (const column of ["logistics_stage", "shipment_kind"])
    await assert.rejects(
      db.$executeRawUnsafe(
        `UPDATE shipments SET ${column}='INVALID' WHERE id=$1::uuid`,
        a[0].id,
      ),
    );
  for (const [i, code] of Object.values(ShipmentChargeCode).entries())
    await db.$executeRawUnsafe(
      `INSERT INTO shipment_charges(shipment_id,line_no,charge_code,amount,currency) VALUES($1::uuid,$2,$3,9999999999999999.99,'CNY')`,
      a[0].id,
      i + 1,
      code,
    );
  await db.$executeRawUnsafe(
    `INSERT INTO shipment_charges(shipment_id,line_no,charge_code,amount,currency) VALUES($1::uuid,8,$2,8.01,'CNY')`,
    a[0].id,
    ShipmentChargeCode.DOMESTIC_SHIPPING,
  );
  for (const [line, code, amount, currency] of [
    [1, "OTHER", "1", "CNY"],
    [0, "OTHER", "1", "CNY"],
    [9, "BAD", "1", "CNY"],
    [9, "OTHER", "10000000000000000", "CNY"],
    [9, "OTHER", "1", "BAD!"],
  ])
    await assert.rejects(
      db.$executeRawUnsafe(
        `INSERT INTO shipment_charges(shipment_id,line_no,charge_code,amount,currency) VALUES($1::uuid,$2,$3,$4::numeric,$5)`,
        a[0].id,
        line,
        code,
        amount,
        currency,
      ),
    );
  for (const milestone of Object.values(ShipmentMilestoneCode))
    await db.$executeRawUnsafe(
      `INSERT INTO shipment_milestones(shipment_id,milestone_code,occurred_at) VALUES($1::uuid,$2,CURRENT_TIMESTAMP)`,
      a[0].id,
      milestone,
    );
  await assert.rejects(
    db.$executeRawUnsafe(
      `INSERT INTO shipment_milestones(shipment_id,milestone_code,occurred_at) VALUES($1::uuid,'INVALID',CURRENT_TIMESTAMP)`,
      a[0].id,
    ),
  );
  await assert.rejects(
    db.$executeRawUnsafe(
      `INSERT INTO shipment_milestones(shipment_id,milestone_code,occurred_at) VALUES($1::uuid,$2,CURRENT_TIMESTAMP)`,
      a[0].id,
      ShipmentMilestoneCode.ORIGIN_RECEIVED,
    ),
  );
  await db.$executeRawUnsafe(
    `INSERT INTO shipment_items(shipment_id,line_no,name,quantity,unit_value,currency) VALUES($1::uuid,1,'exact',0,1234567890123456.78,'CNY')`,
    a[0].id,
  );
  const invalidItems = [
    ["unit_value=NULL", "chk_shipment_items_value_pair"],
    ["currency=NULL", "chk_shipment_items_value_pair"],
    ["unit_value='NaN'::numeric", "chk_shipment_items_value_finite"],
    ["unit_value=-1", "chk_shipment_items_value_nonneg"],
    ["currency='cnY'", "chk_shipment_items_currency"],
  ];
  for (const [assignment, constraint] of invalidItems)
    await assert.rejects(
      db.$executeRawUnsafe(
        `UPDATE shipment_items SET ${assignment} WHERE shipment_id=$1::uuid`,
        a[0].id,
      ),
      (e) =>
        e.meta?.message?.includes(constraint) || e.message.includes(constraint),
    );
  for (const assignment of [
    "line_no=0",
    "name='  '",
    "quantity=-1",
    "unit_value=10000000000000000",
  ])
    await assert.rejects(
      db.$executeRawUnsafe(
        `UPDATE shipment_items SET ${assignment} WHERE shipment_id=$1::uuid`,
        a[0].id,
      ),
    );
  assert.equal(
    (
      await db.$queryRawUnsafe(
        `SELECT unit_value::text AS value FROM shipment_items WHERE shipment_id=$1::uuid`,
        a[0].id,
      )
    )[0].value,
    "1234567890123456.78",
  );
  const h = (sv, pv, to) =>
    db.$executeRawUnsafe(
      `INSERT INTO shipment_stage_history(shipment_id,source_version,processor_version,to_stage) VALUES($1::uuid,$2,$3,$4)`,
      a[0].id,
      sv,
      pv,
      to,
    );
  await h(1, 1, LogisticsStage.UNKNOWN);
  await h(1, 2, LogisticsStage.DELIVERED);
  await assert.rejects(h(1, 2, LogisticsStage.DELIVERED));
  await assert.rejects(h(null, 3, LogisticsStage.DELIVERED));
  const rows = await db.$queryRawUnsafe(
    `SELECT amount::text FROM shipment_charges WHERE shipment_id=$1::uuid ORDER BY line_no`,
    a[0].id,
  );
  assert.equal(rows[0].amount, "9999999999999999.99");
  assert.equal(rows.at(-1).amount, "8.01");

  const fks = await db.$queryRawUnsafe(
    `SELECT t.relname AS table_name,a.attname AS column_name,r.relname AS referenced_table,c.confdeltype::text AS confdeltype FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_class r ON r.oid=c.confrelid JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=ANY(c.conkey) WHERE c.contype='f' AND t.relname IN ('shipments','shipment_charges','shipment_stage_history','shipment_milestones','shipment_items')`,
  );
  for (const [table, column, target, action] of [
    ["shipments", "owner_user_id", "users", "r"],
    ["shipments", "source_identity_id", "sync_source_identities", "r"],
    ["shipments", "carrier_connection_id", "carrier_connections", "n"],
    ["shipments", "customer_id", "customers", "r"],
    ["shipments", "assignee_user_id", "users", "n"],
    ["shipments", "updated_by_user_id", "users", "n"],
    ["shipment_charges", "shipment_id", "shipments", "c"],
    ["shipment_milestones", "shipment_id", "shipments", "c"],
    ["shipment_items", "shipment_id", "shipments", "c"],
    ["shipment_stage_history", "shipment_id", "shipments", "c"],
    ["shipment_stage_history", "sync_job_id", "sync_jobs", "n"],
  ]) {
    const fk = fks.find(
      (x) => x.table_name === table && x.column_name === column,
    );
    assert.ok(fk);
    assert.equal(fk.referenced_table, target);
    assert.equal(fk.confdeltype, action);
  }
  assert.equal(fks.length, 11);
  const indexes = await db.$queryRawUnsafe(
    `SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('shipments','shipment_charges','shipment_stage_history','shipment_milestones','shipment_items')`,
  );
  for (const [name, fragment] of [
    [
      "idx_shipments_owner_stage_created",
      "(owner_user_id, logistics_stage, created_at DESC, id DESC)",
    ],
    [
      "idx_shipments_owner_created",
      "(owner_user_id, created_at DESC, id DESC)",
    ],
    ["idx_shipments_owner_tracking", "(owner_user_id, tracking_code)"],
    ["idx_shipments_customer", "WHERE (customer_id IS NOT NULL)"],
    [
      "idx_shipment_history_observed",
      "(shipment_id, observed_at DESC, id DESC)",
    ],
    ["uq_shipments_source", "UNIQUE"],
    ["uq_shipment_charges_line", "(shipment_id, line_no)"],
    ["uq_shipment_milestones_code", "(shipment_id, milestone_code)"],
    ["uq_shipment_items_line", "(shipment_id, line_no)"],
    [
      "uq_shipment_history_version",
      "(shipment_id, source_version, processor_version)",
    ],
  ])
    assert.ok(
      indexes.find((x) => x.indexname === name)?.indexdef.includes(fragment),
      name,
    );
  assert.ok(
    !indexes.some((x) => /claim/i.test(x.indexname)),
    "no unverified claim index",
  );
  const childIndexes = indexes.filter((x) =>
    /shipment_(?:milestones|items)/.test(x.indexdef),
  );
  assert.equal(
    childIndexes.length,
    4,
    "children have only PK and unique indexes",
  );
  const source = await db.syncSourceIdentity.create({
    data: {
      owner_user_id: u.id,
      provider: "uniship",
      external_account_id: "schema",
      sync_type: "SHIPMENT",
      source_key_scheme: "schema-v1",
      source_key: "unique",
      source_key_hash: "a".repeat(64),
    },
  });
  const connection = await db.carrierConnection.create({
    data: {
      userId: u.id,
      provider: "uniship",
      externalAccountId: "schema",
      displayName: "schema",
      status: "CONNECTED",
    },
  });
  const customer = await db.customer.create({
    data: {
      ownerUserId: u.id,
      createdByUserId: u.id,
      name: "schema",
      phone: "+84912345678",
    },
  });
  const linked = await db.shipment.create({
    data: {
      ownerUserId: u.id,
      sourceIdentityId: source.id,
      provider: "uniship",
      carrierConnectionId: connection.id,
      customerId: customer.id,
      trackingCode: "same",
    },
  });
  await assert.rejects(
    db.shipment.create({
      data: {
        ownerUserId: u.id,
        sourceIdentityId: source.id,
        provider: "uniship",
        trackingCode: "same",
      },
    }),
  );
  await assert.rejects(
    db.syncSourceIdentity.delete({ where: { id: source.id } }),
  );
  await assert.rejects(db.customer.delete({ where: { id: customer.id } }));
  const job = await db.syncJob.create({
    data: {
      owner_user_id: u.id,
      carrier_connection_id: connection.id,
      provider: "uniship",
      external_account_id: "schema",
      sync_type: "SHIPMENT",
      trigger_source: "MANUAL",
      generation: 0,
      lifecycle_version: 1,
    },
  });
  const observation = await db.shipmentStageHistory.create({
    data: {
      shipmentId: linked.id,
      sourceVersion: 1,
      processorVersion: 1,
      toStage: LogisticsStage.UNKNOWN,
      syncJobId: job.id,
    },
  });
  await db.syncJob.delete({ where: { id: job.id } });
  assert.equal(
    (
      await db.shipmentStageHistory.findUniqueOrThrow({
        where: { id: observation.id },
      })
    ).syncJobId,
    null,
  );
  await db.carrierConnection.delete({ where: { id: connection.id } });
  assert.equal(
    (await db.shipment.findUniqueOrThrow({ where: { id: linked.id } }))
      .carrierConnectionId,
    null,
  );
  await db.shipment.delete({ where: { id: a[0].id } });
  assert.equal(
    await db.shipmentCharge.count({ where: { shipmentId: a[0].id } }),
    0,
  );
  assert.equal(
    await db.shipmentStageHistory.count({ where: { shipmentId: a[0].id } }),
    0,
  );
  assert.equal(
    await db.shipmentMilestone.count({ where: { shipmentId: a[0].id } }),
    0,
  );
  assert.equal(
    await db.shipmentItem.count({ where: { shipmentId: a[0].id } }),
    0,
  );
  for (const assignment of [
    "provider='uniship'",
    "provider_status='invalid-without-provider'",
    "weight_kg=-0.001",
    "package_count=-1",
    "item_count=-1",
    "total_currency='cnY'",
  ])
    await assert.rejects(
      db.$executeRawUnsafe(
        `UPDATE shipments SET ${assignment} WHERE id=$1::uuid`,
        b[0].id,
      ),
    );
  for (const field of [
    "weight_kg",
    "total_amount",
    "declared_value",
    "exchange_rate",
  ])
    await assert.rejects(
      db.$executeRawUnsafe(
        `UPDATE shipments SET ${field}='NaN'::numeric WHERE id=$1::uuid`,
        b[0].id,
      ),
    );
};
