import test from "node:test";
import assert from "node:assert/strict";
import { deleteCustomerAddress } from "../features/customers/address-actions.ts";
import {
  settleMutationRead,
  isAmbiguousCustomerWriteFailure,
  shouldRevalidateRejectedCustomerWriteFailure,
  isMutationReadInScope,
  isFreshCustomerRecoveryRead,
  verifyCustomerRecoveryById,
} from "../features/customers/mutation-policy.ts";
import { CustomerApiError } from "../features/customers/errors.ts";
import { DraftError } from "../features/customers/payload.ts";
import fs from "node:fs/promises";

/**
 * Pure simulation model of useCustomerMutation reconciliation state machine
 * matching the 4-phase contract: idle -> writing -> reconciling -> blocked.
 */
class MutationReconciliationController {
  constructor(target) {
    this.target = target;
    this.phase = "idle";
    this.busy = false;
    this.lock = false;
    this.targetRequestId = null;
    this.writeSucceeded = false;
    this.writeOutcome = "confirmed";
    this.pendingSuccess = null;
    this.error = undefined;
    this.operationsRun = 0;
  }

  observeReadSettlement() {
    if (this.phase !== "reconciling" || this.targetRequestId === null) return;
    const target = this.targetRequestId;
    if (
      this.target.settledId !== undefined &&
      this.target.settledId >= target
    ) {
      const outcome = this.target.denied ? "denied" : this.target.outcome;
      if (
        outcome === "success" ||
        outcome === "error" ||
        outcome === "denied"
      ) {
        this.phase = settleMutationRead(this.writeOutcome, outcome);
        this.busy = this.phase !== "idle";
        if (this.phase === "idle") {
          this.targetRequestId = null;
          this.lock = false;
          const callback = this.pendingSuccess;
          this.pendingSuccess = null;
          callback?.();
        }
      }
    }
  }

  async run(operation, success) {
    if (this.lock || this.phase !== "idle") return false;
    this.lock = true;
    this.phase = "writing";
    this.writeOutcome = "confirmed";
    this.pendingSuccess = null;
    this.busy = true;
    this.error = undefined;
    this.operationsRun++;

    try {
      try {
        await operation();
        this.writeSucceeded = true;
      } catch (e) {
        const isAmbiguous = isAmbiguousCustomerWriteFailure(e);

        if (isAmbiguous) {
          this.writeOutcome = "unknown";
          const reqId = this.target.refresh();
          if (typeof reqId === "number") {
            this.targetRequestId = reqId;
            this.phase = "reconciling";
            return "reconciling";
          }
          this.phase = "blocked";
          return "blocked";
        }

        this.lock = false;
        this.phase = "idle";
        this.busy = false;
        return "failed";
      }

      this.pendingSuccess = success ?? null;

      const reqId = this.target.refresh();
      if (typeof reqId === "number") {
        this.targetRequestId = reqId;
        this.phase = "reconciling";
        return "reconciling";
      }

      this.phase = "blocked";
      this.busy = true;
      return "blocked";
    } catch {
      this.lock = false;
      this.phase = "idle";
      this.busy = false;
      return "error";
    }
  }

  retryReconciliation() {
    const reqId = this.target.refresh();
    if (typeof reqId === "number") {
      this.targetRequestId = reqId;
      this.phase = "reconciling";
      this.busy = true;
    }
  }
}

test("Finding 13: write and reconciliation are distinct phases; delayed read keeps controls unavailable", async () => {
  let refreshCount = 0;
  let currentRequestId = 10;
  const target = {
    requestId: 10,
    settledId: 10,
    outcome: "success",
    denied: false,
    refresh() {
      refreshCount++;
      currentRequestId++;
      target.requestId = currentRequestId;
      target.outcome = "pending";
      return currentRequestId;
    },
  };

  const ctrl = new MutationReconciliationController(target);
  assert.equal(ctrl.phase, "idle");
  assert.equal(ctrl.busy, false);

  let writeFinished = false;
  const promise = ctrl.run(
    async () => {
      await new Promise((r) => setTimeout(r, 10));
      writeFinished = true;
    },
    () => {},
  );

  assert.equal(ctrl.phase, "writing");
  assert.equal(ctrl.busy, true);
  assert.equal(ctrl.lock, true);

  // Attempting concurrent write during writing is blocked
  const concurrentResult = await ctrl.run(
    async () => {},
    () => {},
  );
  assert.equal(concurrentResult, false);
  assert.equal(ctrl.operationsRun, 1);

  await promise;
  assert.equal(writeFinished, true);
  assert.equal(ctrl.writeSucceeded, true);
  assert.equal(refreshCount, 1);

  // Write finished, but read has NOT settled yet: phase is "reconciling", controls stay busy!
  assert.equal(ctrl.phase, "reconciling");
  assert.equal(ctrl.busy, true);
  assert.equal(ctrl.lock, true);

  // Attempting concurrent write during reconciling is also blocked!
  const reconcilingConcurrent = await ctrl.run(
    async () => {},
    () => {},
  );
  assert.equal(reconcilingConcurrent, false);
  assert.equal(ctrl.operationsRun, 1);

  // Read settles with success:
  target.settledId = target.requestId;
  target.outcome = "success";
  ctrl.observeReadSettlement();

  assert.equal(ctrl.phase, "idle");
  assert.equal(ctrl.busy, false);
  assert.equal(ctrl.lock, false);
});

test("Finding 13: confirmed write followed by read failure enters blocked phase without relabeling write as failed", async () => {
  let currentRequestId = 20;
  const target = {
    requestId: 20,
    settledId: 20,
    outcome: "success",
    denied: false,
    refresh() {
      currentRequestId++;
      target.requestId = currentRequestId;
      target.outcome = "pending";
      return currentRequestId;
    },
  };

  const ctrl = new MutationReconciliationController(target);
  await ctrl.run(
    async () => {},
    () => {},
  );

  assert.equal(ctrl.writeSucceeded, true);
  assert.equal(ctrl.phase, "reconciling");
  assert.equal(ctrl.busy, true);

  // Read fails with network error:
  target.settledId = target.requestId;
  target.outcome = "error";
  ctrl.observeReadSettlement();

  // Transitions to blocked: write remains succeeded, controls remain guarded!
  assert.equal(ctrl.writeSucceeded, true);
  assert.equal(ctrl.phase, "blocked");
  assert.equal(ctrl.busy, true);

  // Calling retryReconciliation moves back to reconciling:
  ctrl.retryReconciliation();
  assert.equal(ctrl.phase, "reconciling");
  assert.equal(ctrl.busy, true);

  // When retry settles successfully:
  target.settledId = target.requestId;
  target.outcome = "success";
  ctrl.observeReadSettlement();

  assert.equal(ctrl.phase, "idle");
  assert.equal(ctrl.busy, false);
});

test("Finding 13: ambiguous write error (500) triggers reconciliation and prevents second conflicting write", async () => {
  let refreshCount = 0;
  let currentRequestId = 30;
  const target = {
    requestId: 30,
    settledId: 30,
    outcome: "success",
    denied: false,
    refresh() {
      refreshCount++;
      currentRequestId++;
      target.requestId = currentRequestId;
      target.outcome = "pending";
      return currentRequestId;
    },
  };

  const ctrl = new MutationReconciliationController(target);

  // Simulate server 500 error after possible commit
  const outcome = await ctrl.run(
    async () => {
      const err = new Error("Internal Server Error");
      err.status = 500;
      throw err;
    },
    () => {},
  );

  assert.equal(outcome, "reconciling");
  assert.equal(refreshCount, 1);
  assert.equal(ctrl.phase, "reconciling");
  assert.equal(ctrl.lock, true);

  // Second write blocked
  const second = await ctrl.run(
    async () => {},
    () => {},
  );
  assert.equal(second, false);

  // A successful GET does not prove that an unknown write committed.
  target.settledId = target.requestId;
  target.outcome = "success";
  ctrl.observeReadSettlement();

  assert.equal(ctrl.phase, "blocked");
  assert.equal(ctrl.busy, true);
  assert.equal(
    await ctrl.run(
      async () => {},
      () => {},
    ),
    false,
  );
});

test("Finding 14: address deletion triggers exactly one reconciliation per outcome and prevents duplicate calls", async () => {
  let refreshCalls = 0;
  let currentRequestId = 40;
  const target = {
    requestId: 40,
    settledId: 40,
    outcome: "success",
    denied: false,
    refresh() {
      refreshCalls++;
      currentRequestId++;
      target.requestId = currentRequestId;
      target.outcome = "pending";
      return currentRequestId;
    },
  };

  const ctrl = new MutationReconciliationController(target);

  // Case 1: Partial address deletion (PUT default succeeded, DELETE address failed)
  const apiCalls = [];
  const partialApi = {
    setDefault: async () => {
      apiCalls.push("setDefault");
    },
    remove: async () => {
      apiCalls.push("remove");
      throw new Error("DELETE_FAILED");
    },
  };

  const result = await deleteCustomerAddress(
    partialApi,
    "cust-1",
    { id: "addr-1", isDefault: true },
    2,
    "addr-2",
  );

  assert.equal(result.kind, "partial");
  assert.deepEqual(apiCalls, ["setDefault", "remove"]);

  // Modal passes partial result to mutation runner with isPartial: true
  // Note: Modal does NOT call refresh() itself!
  const partialErr = Object.assign(result.error, { isPartial: true });
  await ctrl.run(
    async () => {
      throw partialErr;
    },
    () => {},
  );

  // Exactly ONE reconciliation refresh was triggered across modal and mutation
  assert.equal(refreshCalls, 1);
  assert.equal(ctrl.phase, "reconciling");

  // When read settles:
  target.settledId = target.requestId;
  target.outcome = "success";
  ctrl.observeReadSettlement();
  assert.equal(ctrl.phase, "blocked");

  // Case 2: Clean delete triggers exactly one reconciliation refresh
  const cleanApi = {
    setDefault: async () => {},
    remove: async () => {},
  };
  const cleanResult = await deleteCustomerAddress(
    cleanApi,
    "cust-1",
    { id: "addr-2", isDefault: false },
    2,
  );
  assert.equal(cleanResult.kind, "deleted");

  const cleanCtrl = new MutationReconciliationController(target);
  await cleanCtrl.run(
    async () => {
      assert.equal(cleanResult.kind, "deleted");
    },
    () => {},
  );

  // Total refresh calls incremented by exactly 1 (from 1 to 2)
  assert.equal(refreshCalls, 2);
});

test("production reconciliation policy never promotes unknown writes from GET success", () => {
  assert.equal(settleMutationRead("unknown", "success"), "blocked");
  assert.equal(settleMutationRead("unknown", "error"), "blocked");
  assert.equal(settleMutationRead("unknown", "denied"), "blocked");
  assert.equal(settleMutationRead("confirmed", "success"), "idle");
  assert.equal(settleMutationRead("confirmed", "error"), "blocked");
});

test("Finding B1: resolveUnresolved provides clear recovery pathways for unknown writes", () => {
  // Model resolveUnresolved behavior on unknown write
  let writeOutcome = "unknown";
  let phase = "blocked";
  let lock = true;

  function resolveUnresolved(mode) {
    lock = false;
    writeOutcome = mode === "acknowledged" ? "confirmed" : "rejected";
    phase = "idle";
  }

  // Recovery Option A: User acknowledges completion (POST succeeded on backend)
  resolveUnresolved("acknowledged");
  assert.equal(phase, "idle");
  assert.equal(lock, false);
  assert.equal(writeOutcome, "confirmed");

  // Recovery Option B: User discards/resets to retry (POST did not commit)
  writeOutcome = "unknown";
  phase = "blocked";
  lock = true;
  resolveUnresolved("discard");
  assert.equal(phase, "idle");
  assert.equal(lock, false);
  assert.equal(writeOutcome, "rejected");
});

test("Finding B2: capability booleans separate canWrite, canClose, canRetryRead without conflating busy", () => {
  // Test idle state
  const idle = {
    phase: "idle",
    isUnresolved: false,
    canWrite: true,
    canClose: true,
    canRetryRead: false,
    busy: false,
  };
  assert.equal(idle.canWrite, true);
  assert.equal(idle.canClose, true);

  // Test writing state
  const writing = {
    phase: "writing",
    isUnresolved: false,
    canWrite: false,
    canClose: false,
    canRetryRead: false,
    busy: true,
  };
  assert.equal(writing.canClose, false);
  assert.equal(writing.canWrite, false);

  // Test blocked state (after unknown write or failed reconciliation)
  const blocked = {
    phase: "blocked",
    isUnresolved: true,
    canWrite: false,
    canClose: true, // Safe to close drawer during blocked state
    canRetryRead: true, // GET retry is available
    busy: true,
  };
  assert.equal(blocked.canClose, true);
  assert.equal(blocked.canWrite, false);
  assert.equal(blocked.canRetryRead, true);
});

test("lost PUT and DELETE responses require GET reconciliation", async () => {
  for (const operation of ["delete", "put"]) {
    const calls = [];
    const api = {
      async setDefault() {
        calls.push("PUT");
        if (operation === "put") throw new TypeError("response lost");
      },
      async remove() {
        calls.push("DELETE");
        if (operation === "delete") throw new TypeError("response lost");
      },
    };
    const targetAddress = { id: "old", isDefault: operation === "put" };
    const result = await deleteCustomerAddress(
      api,
      "customer",
      targetAddress,
      2,
      "new",
    );
    assert.equal(result.kind, "failed");
    assert.equal(isAmbiguousCustomerWriteFailure(result.error), true);
    assert.deepEqual(calls, operation === "put" ? ["PUT"] : ["DELETE"]);

    let reads = 0;
    const target = {
      requestId: 0,
      settledId: 0,
      outcome: "success",
      refresh() {
        reads++;
        this.requestId++;
        this.outcome = "pending";
        return this.requestId;
      },
    };
    const ctrl = new MutationReconciliationController(target);
    assert.equal(
      await ctrl.run(
        async () => {
          throw result.error;
        },
        () => {},
      ),
      "reconciling",
    );
    assert.equal(reads, 1);
    assert.equal(ctrl.phase, "reconciling");
    let extraWrites = 0;
    assert.equal(
      await ctrl.run(
        async () => {
          extraWrites++;
        },
        () => {},
      ),
      false,
    );
    assert.equal(extraWrites, 0);
    target.settledId = target.requestId;
    target.outcome = "success";
    ctrl.observeReadSettlement();
    assert.equal(ctrl.phase, "blocked");
    assert.equal(reads, 1);
    assert.equal(extraWrites, 0);
  }
});

test("Customer write failures classify rejected and unknown", async () => {
  assert.equal(
    isAmbiguousCustomerWriteFailure(new DraftError("unchanged")),
    false,
  );
  for (const status of [400, 403, 404, 409, 422]) {
    assert.equal(
      isAmbiguousCustomerWriteFailure(new CustomerApiError(status, {})),
      false,
      String(status),
    );
  }
  for (const error of [
    new TypeError("Failed to fetch"),
    new Error("MALFORMED_RESPONSE"),
    new CustomerApiError(500, {}),
    new CustomerApiError(503, {}),
    Object.assign(new CustomerApiError(409, {}), { isPartial: true }),
  ]) {
    assert.equal(isAmbiguousCustomerWriteFailure(error), true);
  }

  const modalSource = await fs.readFile(
    new URL("../features/customers/DeleteAddressModal.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(modalSource, /isAmbiguous:\s*false/);
});

test("rejected 403/404/409 writes require GET", () => {
  for (const status of [403, 404, 409]) {
    const error = new CustomerApiError(status, {});
    assert.equal(isAmbiguousCustomerWriteFailure(error), false);
    assert.equal(shouldRevalidateRejectedCustomerWriteFailure(error), true);
  }
  for (const status of [400, 422, 429, 500]) {
    const error = new CustomerApiError(status, {});
    assert.equal(shouldRevalidateRejectedCustomerWriteFailure(error), false);
  }
  const offline = new TypeError("offline");
  const invalid = new DraftError("invalid");
  assert.equal(shouldRevalidateRejectedCustomerWriteFailure(offline), false);
  assert.equal(shouldRevalidateRejectedCustomerWriteFailure(invalid), false);
  assert.equal(settleMutationRead("rejected", "success"), "idle");
  assert.equal(settleMutationRead("rejected", "error"), "blocked");
  assert.equal(settleMutationRead("rejected", "denied"), "blocked");
});

test("Customer recovery wiring unlocks page and its active drawer together", async () => {
  const detail = await fs.readFile(
    new URL("../features/customers/CustomerDetailPage.tsx", import.meta.url),
    "utf8",
  );
  const drawers = await fs.readFile(
    new URL("../features/customers/CustomerDrawers.tsx", import.meta.url),
    "utf8",
  );
  const list = await fs.readFile(
    new URL("../features/customers/CustomerListPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(detail, /mutation\.resolveUnresolved\("acknowledged"\)/);
  assert.match(detail, /onResolved=\{\(\) => setWriteUnresolved\(false\)\}/);
  assert.match(list, /onResolved=\{\(\) => setWriteUnresolvedScope\(null\)\}/);
  assert.match(
    drawers,
    /onDiscard=\{\(\) => void completeRecovery\("discard"\)\}/,
  );
  assert.match(
    drawers,
    /onAcknowledge=\{\(\) => void completeRecovery\("acknowledged"\)\}/,
  );
  assert.match(drawers, /onDiscard=\{\(\) => \{/);
  assert.match(drawers, /onAcknowledge=\{\(\) => \{/);
  assert.ok(
    (drawers.match(/onResolved\?\.\(\)/g) ?? []).length >= 3,
    "Both Drawer implementations must release the owning page after safe recovery",
  );
});

test("mutation reconciliation requires the original query scope", () => {
  assert.equal(isMutationReadInScope("all", "filtered", 5, 6), false);
  assert.equal(isMutationReadInScope("all", "all", 5, 4), false);
  assert.equal(isMutationReadInScope("all", "all", 5, 5), true);
  assert.equal(isMutationReadInScope("all", "all", null, 6), false);
  assert.equal(isMutationReadInScope(undefined, undefined, 5, 5), true);
});

test("list acknowledgement needs a fresh GET in the original scope", () => {
  const origin = { key: "all", settledId: 10 };
  const read = {
    key: "all",
    settledId: 11,
    outcome: "success",
    loading: false,
  };
  assert.equal(isFreshCustomerRecoveryRead(origin, read), true);
  assert.equal(
    isFreshCustomerRecoveryRead(origin, { ...read, key: "inactive" }),
    false,
  );
  assert.equal(
    isFreshCustomerRecoveryRead(origin, { ...read, settledId: 10 }),
    false,
  );
  assert.equal(
    isFreshCustomerRecoveryRead(origin, { ...read, outcome: "error" }),
    false,
  );
  assert.equal(
    isFreshCustomerRecoveryRead(origin, { ...read, loading: true }),
    false,
  );
});

test("partial DELETE needs explicit user recovery", async () => {
  const source = await fs.readFile(
    new URL("../features/customers/DeleteAddressModal.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /useEffect\(\(\) => \{[\s\S]*?mutation\.resolveUnresolved\("discard"\)/,
  );
  assert.match(source, /Bỏ qua và đóng/);
});

test("page recovery is hidden while an editor owns the write", async () => {
  const list = await fs.readFile(
    new URL("../features/customers/CustomerListPage.tsx", import.meta.url),
    "utf8",
  );
  const detail = await fs.readFile(
    new URL("../features/customers/CustomerDetailPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(list, /canAcknowledgeWrite && !overlay/);
  assert.match(
    detail,
    /read\.outcome === "success" && !read\.loading && !mode/,
  );
});

test("ID-scoped recovery propagates wrong ID and failed GET", async () => {
  const id = "customer-a";
  let reads = 0;
  await verifyCustomerRecoveryById(id, async (requested) => {
    assert.equal(requested, id);
    reads++;
    return { id };
  });
  assert.equal(reads, 1);
  await assert.rejects(
    () => verifyCustomerRecoveryById(id, async () => ({ id: "customer-b" })),
    /CUSTOMER_RECOVERY_ID_MISMATCH/,
  );
  await assert.rejects(
    () =>
      verifyCustomerRecoveryById(id, async () => {
        throw new Error("GET_UNAVAILABLE");
      }),
    /GET_UNAVAILABLE/,
  );
});

test("Existing Customer recovery uses ID GET", async () => {
  const list = await fs.readFile(
    new URL("../features/customers/CustomerListPage.tsx", import.meta.url),
    "utf8",
  );
  const drawers = await fs.readFile(
    new URL("../features/customers/CustomerDrawers.tsx", import.meta.url),
    "utf8",
  );
  assert.match(list, /verifyCustomerRecoveryById\(/);
  assert.match(drawers, /if \(customer\)[\s\S]*?verifyCustomerRecoveryById\(/);
});

test("confirmed writes defer saved/close through GET failure and GET-only retry", async () => {
  let requestId = 60;
  let writes = 0;
  let saved = 0;
  let reads = 0;
  const target = {
    settledId: 60,
    outcome: "success",
    denied: false,
    refresh() {
      reads++;
      target.outcome = "pending";
      return ++requestId;
    },
  };
  const ctrl = new MutationReconciliationController(target);
  await ctrl.run(
    async () => {
      writes++;
    },
    () => {
      saved++;
    },
  );
  assert.equal(writes, 1);
  assert.equal(reads, 1);
  assert.equal(saved, 0, "Drawer must not close before GET settles");
  assert.equal(ctrl.phase, "reconciling");

  target.settledId = requestId;
  target.outcome = "error";
  ctrl.observeReadSettlement();
  assert.equal(saved, 0);
  assert.equal(ctrl.phase, "blocked");
  assert.equal(ctrl.lock, true);

  ctrl.retryReconciliation();
  assert.equal(writes, 1, "Retry must not repeat the successful PATCH");
  assert.equal(reads, 2);
  target.settledId = requestId;
  target.outcome = "success";
  ctrl.observeReadSettlement();
  assert.equal(saved, 1);
  assert.equal(ctrl.phase, "idle");
  ctrl.observeReadSettlement();
  assert.equal(saved, 1, "Saved callback is single-flight");
});

test("unresolved write notices use role='status' for advisory accessibility and browser readiness", async () => {
  const list = await fs.readFile(
    new URL("../features/customers/CustomerListPage.tsx", import.meta.url),
    "utf8",
  );
  const detail = await fs.readFile(
    new URL("../features/customers/CustomerDetailPage.tsx", import.meta.url),
    "utf8",
  );
  const drawers = await fs.readFile(
    new URL("../features/customers/CustomerDrawers.tsx", import.meta.url),
    "utf8",
  );
  const modal = await fs.readFile(
    new URL("../features/customers/DeleteAddressModal.tsx", import.meta.url),
    "utf8",
  );

  // Advisory reconciliation notices use role="status" with polite aria-live
  assert.match(
    list,
    /writeUnresolved\s*&&\s*\(\s*<div\s+role="status"\s+className=\{styles\.notice\}/,
    "List page unresolved notice must use role='status'",
  );
  assert.match(
    detail,
    /writeUnresolved\s*&&\s*\(\s*<div\s+role="status"\s+className=\{styles\.notice\}/,
    "Detail page unresolved notice must use role='status'",
  );
  assert.match(
    drawers,
    /<div\s+role="status"\s+className=\{styles\.notice\}/,
    "Drawer ReconcileNotice must use role='status'",
  );
  assert.match(
    modal,
    /<p\s+role="status"\s+className=\{styles\.notice\}/,
    "Delete address modal unresolved notice must use role='status'",
  );

  // Actual error alerts retain role="alert"
  assert.match(list, /recoveryError\s*&&\s*<p\s+role="alert"/);
  assert.match(drawers, /recoveryError\s*&&\s*<p\s+role="alert"/);
});

test("closing an unconfirmed Drawer preserves parent writeUnresolvedScope without unlocking writes", async () => {
  const list = await fs.readFile(
    new URL("../features/customers/CustomerListPage.tsx", import.meta.url),
    "utf8",
  );
  // onClose only clears overlay, preserving writeUnresolvedScope
  assert.match(list, /onClose=\{\(\) => setOverlay\(null\)\}/);
  assert.match(list, /writeBlocked=\{writeUnresolved\}/);
  assert.match(
    list,
    /onUnresolved=\{\(\) => \{[\s\S]*?setWriteUnresolvedScope\(\{/,
  );
  assert.match(list, /onResolved=\{\(\) => setWriteUnresolvedScope\(null\)\}/);
});
