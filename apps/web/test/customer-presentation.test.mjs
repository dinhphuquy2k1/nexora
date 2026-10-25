import test from "node:test";
import assert from "node:assert/strict";
import { customerPageWindow } from "../features/customers/pagination.ts";
test("pagination window stays bounded at huge populations and empty/edge pages", () => {
  for (const total of [0, 1, 2, 10, 2147483647])
    for (const p of [1, 2, 5, 1000000000]) {
      const w = customerPageWindow(p, total);
      assert.ok(w.length <= 5);
      assert.equal(w[0], 1);
      assert.equal(w.at(-1), Math.max(1, total));
      assert.ok(
        w.every(
          (n) => Number.isInteger(n) && n >= 1 && n <= Math.max(1, total),
        ),
      );
    }
  assert.deepEqual(customerPageWindow(5, 10), [1, 4, 5, 6, 10]);
});
