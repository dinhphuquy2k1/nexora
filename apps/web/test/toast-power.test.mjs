import test from "node:test";
import assert from "node:assert/strict";
import {
  enqueueToast,
  dismissToast,
} from "../../../packages/ui/src/toast-state.ts";
import { CustomerPowerFlight } from "../features/customers/power-flight.ts";
test("Toast deduplicates operation IDs, bounds queue and preserves independent persistent errors", () => {
  const first = { id: "one", tone: "error", message: "Không thể lưu" };
  const original = Object.freeze([]);
  const queue = enqueueToast(original, first);
  assert.equal(enqueueToast(queue, { ...first }), queue);
  assert.equal(original.length, 0);
  first.message = "mutated";
  assert.equal(queue[0].message, "Không thể lưu");
  let full = queue;
  for (let i = 0; i < 9; i++)
    full = enqueueToast(full, {
      id: String(i),
      tone: "success",
      message: "Đã lưu",
    });
  assert.equal(full.length, 6);
  assert.equal(full[0].id, "one");
  assert.equal(
    dismissToast(full, "one").some((t) => t.id === "one"),
    false,
  );
});
test("Power uses one synchronous gate through write and accepted read settlement", () => {
  const gate = new CustomerPowerFlight();
  const first = gate.begin("A");
  assert.ok(first);
  assert.equal(gate.begin("B"), null);
  gate.reconcile(first, 4);
  assert.equal(gate.begin("B"), null);
  gate.observe(
    { key: "q", requestId: 4, settledId: 3, loading: true, outcome: "pending" },
    "q",
  );
  assert.equal(gate.snapshot().phase, "revalidating");
  gate.observe(
    {
      key: "old",
      requestId: 4,
      settledId: 4,
      loading: false,
      outcome: "success",
    },
    "q",
  );
  assert.ok(gate.snapshot());
  gate.observe(
    { key: "q", requestId: 4, settledId: 4, loading: false, outcome: "error" },
    "q",
  );
  assert.equal(gate.snapshot().phase, "blocked");
  assert.equal(gate.begin("B"), null);
  gate.observe(
    {
      key: "q",
      requestId: 5,
      settledId: 5,
      loading: false,
      outcome: "success",
    },
    "q",
  );
  assert.equal(gate.snapshot(), null);
  const second = gate.begin("B");
  gate.reject(first);
  assert.equal(gate.snapshot().id, "B");
  gate.reject(second);
  assert.equal(gate.snapshot(), null);
  const third = gate.begin("C");
  gate.cancel();
  assert.equal(gate.matches(third), false);
});

test("Toast view preserves semantic announcements, safe text and keyboard dismiss control", async () => {
  const { loadComponent, React, render } = await import(
    "./helpers/render-component.mjs"
  );
  const { Toast } = loadComponent(
    new URL("../../../packages/ui/src/Toast.tsx", import.meta.url).pathname,
  );
  for (const tone of ["error", "success", "info"]) {
    const html = render(
      React.createElement(Toast, {
        notification: { id: "test", tone, message: "<script>unsafe</script>" },
        dismiss() {},
      }),
    );
    assert.match(
      html,
      new RegExp(`role="${tone === "error" ? "alert" : "status"}"`),
    );
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /aria-label="Đóng thông báo"/);
    assert.match(html, /data-size="default"/);
  }
});
