import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadComponent, React, render } from "./helpers/render-component.mjs";

// Only the accepted read result is controlled. Actual page, badges, mutation
// hook, ToastProvider and React SSR execute through the existing loader cache.
function renderDetail(status, statusLabel) {
  const customer = {
    id: "customer",
    code: "KH000001",
    name: "Synthetic customer",
    phone: "+84912345678",
    email: null,
    note: null,
    status,
    statusLabel,
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-26T00:00:00Z",
    addresses: [],
  };
  const cache = new Map([
    [
      fileURLToPath(
        new URL("../features/customers/useCustomerRead.ts", import.meta.url),
      ),
      {
        exports: {
          useCustomerRead: () => ({
            data: customer,
            loading: false,
            denied: false,
            outcome: "success",
            settledId: 1,
            requestId: 1,
            refresh() {},
            deny() {},
          }),
        },
      },
    ],
  ]);
  const { CustomerDetailPage } = loadComponent(
    new URL("../features/customers/CustomerDetailPage.tsx", import.meta.url),
    cache,
  );
  const { ToastProvider } = loadComponent(
    new URL("../../../packages/ui/src/index.tsx", import.meta.url),
    cache,
  );
  return render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(CustomerDetailPage, { id: customer.id }),
    ),
  );
}

for (const status of ["ACTIVE", "INACTIVE"]) {
  for (const label of ["API detail label", ""]) {
    test(`Detail header and profile use API label ${JSON.stringify(label)} for ${status}`, () => {
      const html = renderDetail(status, label);
      const badges = [
        ...html.matchAll(
          /<span class="[^"]*statusChip [^"]*">(.*?)<\/span><\/span>/gs,
        ),
      ];
      assert.equal(
        badges.length,
        2,
        "render both actual Detail badge consumers",
      );
      const tone = status === "ACTIVE" ? "Active" : "Inactive";
      for (const [badge] of badges) {
        assert.ok(badge.includes(`<span>${label}</span>`));
        assert.match(
          badge,
          new RegExp(
            `badge ${status === "ACTIVE" ? "good" : "bad"} statusChip`,
          ),
        );
        assert.match(badge, new RegExp(`statusChip${tone}`));
        assert.match(badge, new RegExp(`chipDot${tone}`));
      }
      assert.doesNotMatch(html, /Đang hoạt động|Ngừng hoạt động/);
    });
  }
}
