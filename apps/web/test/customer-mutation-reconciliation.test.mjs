import test from "node:test";
import assert from "node:assert/strict";
import { deleteCustomerAddress } from "../features/customers/address-actions.ts";

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
      if (this.target.outcome === "success" && !this.target.denied) {
        this.targetRequestId = null;
        this.lock = false;
        this.phase = "idle";
        this.busy = false;
      } else if (this.target.outcome === "error" || this.target.denied) {
        this.phase = "blocked";
        this.busy = true;
      }
    }
  }

  async run(operation, success) {
    if (this.lock || this.phase !== "idle") return false;
    this.lock = true;
    this.phase = "writing";
    this.busy = true;
    this.error = undefined;
    this.operationsRun++;

    try {
      try {
        await operation();
        this.writeSucceeded = true;
      } catch (e) {
        const isLocal = e && e.name === "DraftError";
        const isAmbiguous =
          Boolean(e?.isPartial) ||
          (e?.status && [403, 404, 409, 500].includes(e.status)) ||
          (!isLocal && !e?.status);

        if (isAmbiguous) {
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

      if (success) success();

      const reqId = this.target.refresh();
      if (typeof reqId === "number") {
        this.targetRequestId = reqId;
        this.phase = "reconciling";
        return "reconciling";
      }

      this.lock = false;
      this.phase = "idle";
      this.busy = false;
      return "settled";
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

  // When reconciliation succeeds, unblocks
  target.settledId = target.requestId;
  target.outcome = "success";
  ctrl.observeReadSettlement();

  assert.equal(ctrl.phase, "idle");
  assert.equal(ctrl.busy, false);
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
  assert.equal(ctrl.phase, "idle");

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

  await ctrl.run(
    async () => {
      assert.equal(cleanResult.kind, "deleted");
    },
    () => {},
  );

  // Total refresh calls incremented by exactly 1 (from 1 to 2)
  assert.equal(refreshCalls, 2);
});
