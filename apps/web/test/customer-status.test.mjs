import { test } from "node:test";
import assert from "node:assert/strict";
import { CustomerStatus, CustomerStatusLabelsVi } from "@nexora/shared";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

test("Web ESM and API CommonJS share status codes and labels with generated OpenAPI", () => {
  const common = require("@nexora/shared");
  assert.equal(common.CustomerStatus, CustomerStatus);
  assert.deepEqual(Object.values(CustomerStatus), ["ACTIVE", "INACTIVE"]);
  assert.deepEqual(CustomerStatusLabelsVi, {
    ACTIVE: "Đang hoạt động",
    INACTIVE: "Ngừng hoạt động",
  });
  const document = require("../../api/openapi/openapi.json");
  for (const name of [
    "CustomerSummaryDto",
    "CustomerDetailDto",
    "PatchCustomerDto",
  ]) {
    assert.deepEqual(
      document.components.schemas[name].properties.status.enum,
      Object.values(CustomerStatus),
    );
  }
  const queryStatus = document.paths["/api/customers"].get.parameters.find(
    (p) => p.name === "status",
  );
  assert.deepEqual(queryStatus.schema.enum, Object.values(CustomerStatus));
  const summary = document.components.schemas.CustomerSummaryDto;
  assert.equal(summary.properties.statusLabel.type, "string");
  assert.ok(summary.required.includes("statusLabel"));
  for (const name of [
    "CreateCustomerDto",
    "PatchCustomerDto",
    "AddressInputDto",
    "AddressPatchDto",
    "CustomerAddressDto",
  ])
    assert.equal(
      document.components.schemas[name].properties.statusLabel,
      undefined,
    );
});

test("shared root exports bundle for a browser without Node/server dependencies", async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { runInNewContext } = await import("node:vm");
  const { webpack } = require("next/dist/compiled/webpack/webpack");
  const dir = await mkdtemp(join(tmpdir(), "nexora-status-browser-"));
  try {
    const entry = join(dir, "entry.js");
    await writeFile(
      entry,
      `import { CustomerStatus, CustomerStatusLabelsVi } from ${JSON.stringify(require.resolve("@nexora/shared"))}; export const options = Object.values(CustomerStatus).map(value => ({value, label: CustomerStatusLabelsVi[value]}));`,
    );
    const compiler = webpack({
      mode: "production",
      target: "web",
      entry,
      devtool: false,
      optimization: { minimize: false },
      output: {
        path: dir,
        filename: "bundle.js",
        library: { name: "StatusContract", type: "var" },
      },
    });
    try {
      await new Promise((resolve, reject) =>
        compiler.run((error, stats) => {
          if (error) return reject(error);
          if (stats.hasErrors())
            return reject(
              new Error(stats.toString({ all: false, errors: true })),
            );
          resolve();
        }),
      );
    } finally {
      await new Promise((resolve, reject) =>
        compiler.close((error) => (error ? reject(error) : resolve())),
      );
    }
    const browser = {};
    runInNewContext(await readFile(join(dir, "bundle.js"), "utf8"), browser);
    assert.deepEqual(
      JSON.parse(JSON.stringify(browser.StatusContract.options)),
      [
        { value: "ACTIVE", label: "Đang hoạt động" },
        { value: "INACTIVE", label: "Ngừng hoạt động" },
      ],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("actual profile dropdown and statistics retain shared labels and canonical status codes", async () => {
  const { loadComponent, React, render } = await import(
    "./helpers/render-component.mjs"
  );
  const { CustomerProfileFields } = loadComponent(
    new URL("../features/customers/CustomerProfileFields.tsx", import.meta.url),
  );
  const { CustomerStatsBar } = loadComponent(
    new URL("../features/customers/CustomerStatsBar.tsx", import.meta.url),
  );
  for (const status of Object.values(CustomerStatus)) {
    const fields = render(
      React.createElement(CustomerProfileFields, {
        value: { name: "Synthetic", phone: "", email: "", note: "", status },
        edit: true,
        onChange() {},
      }),
    );
    const stats = render(
      React.createElement(CustomerStatsBar, {
        stats: { total: 3, active: 2, inactive: 1 },
        loading: false,
        status,
        onChange() {},
      }),
    );
    for (const code of Object.values(CustomerStatus)) {
      assert.match(
        fields,
        new RegExp(
          `<option value="${code}"[^>]*>${CustomerStatusLabelsVi[code]}</option>`,
        ),
      );
      assert.ok(
        stats.includes(CustomerStatusLabelsVi[code].toLocaleUpperCase("vi")),
      );
      assert.ok(stats.includes(`id="customer-tab-${code}"`));
    }
    assert.match(fields, new RegExp(`<option value="${status}" selected=""`));
    assert.match(
      stats,
      new RegExp(`id="customer-tab-${status}"[^>]*aria-selected="true"`),
    );
  }
});
