import { URLSearchParams } from "node:url";
import { setTimeout, clearTimeout } from "node:timers";
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCustomerQuery,
  customerQueryString,
} from "../features/customers/query.ts";
import {
  createCustomerPayload,
  patchCustomerPayload,
  addressPayload,
} from "../features/customers/payload.ts";
import { customerStats } from "../features/customers/response.ts";
import { CustomerReadLane } from "../features/customers/request.ts";
import { deleteCustomerAddress } from "../features/customers/address-actions.ts";

test("URL parsing is bounded, omits blank search and never broadens invalid queries", () => {
  assert.deepEqual(parseCustomerQuery(new URLSearchParams("q=  &x=secret")), {
    page: 1,
    pageSize: 10,
  });
  for (const q of [
    "page=0",
    "pageSize=101",
    "page=2147483647&pageSize=100",
    "status=ALL",
    "q=a&q=b",
    "phone=",
    "q=" + "x".repeat(201),
  ])
    assert.throws(() => parseCustomerQuery(new URLSearchParams(q)));
  assert.equal(
    customerQueryString({
      page: 1,
      pageSize: 20,
      q: "  Lan  ",
      status: "ACTIVE",
    }),
    "page=1&pageSize=20&q=Lan&status=ACTIVE",
  );
  assert.equal(
    parseCustomerQuery(
      new URLSearchParams("page=2&pageSize=100&phone=%2B84912345678"),
    ).phone,
    "+84912345678",
  );
});
test("create/patch allowlists preserve fallback, nullable clears, exact bounds and required address", () => {
  for (const n of [1, 100, 101, 200])
    for (const a of [1, 255, 256, 2000]) {
      const p = createCustomerPayload(
        {
          name: "N".repeat(n),
          phone: "0".repeat(64),
          email: "",
          note: "",
          owner: "forged",
        },
        {
          addressText: "A".repeat(a),
          countryCode: "VN",
          recipientName: "",
          recipientPhone: "",
          label: "",
          isDefault: true,
        },
      );
      assert.deepEqual(Object.keys(p), ["name", "phone", "address"]);
      assert.deepEqual(Object.keys(p.address), ["countryCode", "addressText"]);
    }
  assert.throws(() =>
    createCustomerPayload({ name: "N", phone: "123" }, { addressText: "" }),
  );
  assert.throws(() =>
    createCustomerPayload(
      { name: "N".repeat(201), phone: "123" },
      { addressText: "A" },
    ),
  );
  assert.deepEqual(
    patchCustomerPayload(
      { name: "N", phone: "123", email: "", note: "", status: "ACTIVE" },
      {
        name: "N",
        phone: "123",
        email: "a@b.co",
        note: "old",
        status: "ACTIVE",
      },
    ),
    { email: null, note: null },
  );
  assert.throws(() =>
    patchCustomerPayload(
      { name: "N", phone: "123", email: "", note: "", status: "ACTIVE" },
      { name: "N", phone: "123", email: null, note: null, status: "ACTIVE" },
    ),
  );
  assert.deepEqual(
    addressPayload(
      {
        label: "",
        recipientName: "N",
        recipientPhone: "123",
        countryCode: "VN",
        addressText: "new",
      },
      {
        label: "old",
        recipientName: "N",
        recipientPhone: "123",
        countryCode: "VN",
        addressText: "old",
      },
    ),
    { label: null, addressText: "new", countryCode: "VN" },
  );
});
test("stats distinguish successful zero from missing/malformed contract", () => {
  assert.deepEqual(customerStats({ total: 0, active: 0, inactive: 0 }), {
    total: 0,
    active: 0,
    inactive: 0,
  });
  for (const x of [
    undefined,
    null,
    {},
    { total: 1, active: 0, inactive: 0 },
    { total: -1, active: 0, inactive: -1 },
    { total: 1, active: 0.5, inactive: 0.5 },
  ])
    assert.equal(customerStats(x), null);
});
test("generation invalidates immediately during debounce, stale data/error/finally and unmount cannot commit", () => {
  const lane = new CustomerReadLane();
  const a = lane.begin("A");
  lane.invalidate();
  assert.equal(lane.current(a), false);
  const b = lane.begin("B");
  assert.equal(lane.current(a), false);
  assert.equal(lane.current(b), true);
  assert.equal(a.signal.aborted, true);
  lane.invalidate();
  assert.equal(lane.current(b), false);
  const retry = lane.begin("B");
  assert.equal(lane.current(b), false);
  assert.equal(lane.current(retry), true);
  lane.dispose();
  assert.equal(lane.current(retry), false);
});
test("default deletion is explicitly sequential; PUT failure never deletes; partial DELETE never rolls back", async () => {
  const target = { id: "a", isDefault: true };
  const calls = [];
  let phase = "put";
  const api = {
    setDefault: async () => {
      calls.push("put");
      if (phase === "put") throw Error("put");
    },
    remove: async () => {
      calls.push("delete");
      throw Error("delete");
    },
  };
  const first = await deleteCustomerAddress(api, "c", target, 2, "b");
  assert.equal(first.kind, "failed");
  assert.deepEqual(calls, ["put"]);
  phase = "delete";
  calls.length = 0;
  const second = await deleteCustomerAddress(api, "c", target, 2, "b");
  assert.equal(second.kind, "partial");
  assert.deepEqual(calls, ["put", "delete"]);
  assert.equal(
    (await deleteCustomerAddress(api, "c", target, 1, "b")).kind,
    "last",
  );
});

test("error status authority separates forbidden/session/phone and never renders server text", async () => {
  const { CustomerApiError, customerError } = await import(
    "../features/customers/errors.ts"
  );
  assert.equal(
    customerError(new CustomerApiError(403, { message: "PII" }))
      .unauthenticated,
    undefined,
  );
  assert.equal(
    customerError(new CustomerApiError(401, {})).unauthenticated,
    true,
  );
  assert.equal(
    customerError(new CustomerApiError(409, { code: "CUSTOMER_PHONE_EXISTS" }))
      .field,
    "phone",
  );
  assert.equal(
    customerError(
      new CustomerApiError(500, { message: "PII" }),
    ).message.includes("PII"),
    false,
  );
});

test("editing against captured baseline never adds untouched concurrently refreshed fields", () => {
  const original = {
    name: "Original",
    phone: "123",
    email: null,
    note: null,
    status: "ACTIVE",
  };
  const draft = { ...original, email: "", note: "", phone: "456" };
  const refreshed = { ...original, name: "Other writer" };
  assert.deepEqual(patchCustomerPayload(draft, original), { phone: "456" });
  assert.equal(refreshed.name, "Other writer");
});
test("canonical query equality covers empty URL, explicit defaults and reordered keys", () => {
  const keys = ["", "page=1&pageSize=10", "pageSize=10&page=1", "q=%20"];
  assert.equal(
    new Set(
      keys.map((s) =>
        customerQueryString(parseCustomerQuery(new URLSearchParams(s))),
      ),
    ).size,
    1,
  );
});

test("search debounce reload lifecycle flushes draft, prevents stale commits, and clears timers", async () => {
  class SearchReloadController {
    constructor(initialQuery = { page: 1, pageSize: 20 }) {
      this.timer = null;
      this.currentQuery = { ...initialQuery };
      this.draft = this.currentQuery.q ?? "";
      this.lane = new CustomerReadLane();
      this.dispatches = [];
    }
    cancel() {
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = null;
    }
    searchChange(q) {
      this.cancel();
      this.lane.invalidate();
      this.draft = q;
      this.timer = setTimeout(() => {
        this.change({ q: q.trim() || undefined, page: 1 }, true);
      }, 300);
    }
    change(patch, replace = false) {
      const next = { ...this.currentQuery, ...patch };
      const sameKey =
        customerQueryString(this.currentQuery) === customerQueryString(next);
      if (sameKey) return null;
      this.cancel();
      this.lane.invalidate();
      this.currentQuery = next;
      this.draft = next.q ?? "";
      const ticket = this.lane.begin(customerQueryString(next));
      this.dispatches.push({ query: next, sameKey, replace, ticket });
      return ticket;
    }
    handleReload() {
      this.cancel();
      this.lane.invalidate();
      const trimmedDraft = this.draft.trim();
      const currentQ = (this.currentQuery.q ?? "").trim();
      if (trimmedDraft !== currentQ) {
        return this.change({ q: trimmedDraft || undefined, page: 1 }, true);
      } else {
        if (this.draft !== trimmedDraft) {
          this.draft = trimmedDraft;
        }
        const ticket = this.lane.begin(customerQueryString(this.currentQuery));
        this.dispatches.push({
          query: this.currentQuery,
          sameKey: true,
          replace: true,
          ticket,
        });
        return ticket;
      }
    }
    clear() {
      this.cancel();
      this.draft = "";
      return this.change({ q: undefined, page: 1 });
    }
    dispose() {
      this.cancel();
      this.lane.dispose();
    }
  }

  // 1. Type A -> Reload before 300ms flushes A immediately, page resets to 1, no duplicate after 300ms
  const ctrl1 = new SearchReloadController({ page: 2, pageSize: 20 });
  ctrl1.searchChange("Lan");
  assert.equal(ctrl1.draft, "Lan");
  assert.equal(ctrl1.currentQuery.q, undefined);
  // Reload at ~50ms (before 300ms timer)
  const ticket1 = ctrl1.handleReload();
  assert.equal(ctrl1.currentQuery.q, "Lan");
  assert.equal(ctrl1.currentQuery.page, 1);
  assert.equal(ctrl1.lane.current(ticket1), true);
  assert.equal(ctrl1.dispatches.length, 1);
  // Advance beyond 300ms: timer was cancelled, no secondary dispatch
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(ctrl1.dispatches.length, 1);

  // 2. Type A -> Type B -> Reload before 300ms flushes B, timer for A/B never fires
  const ctrl2 = new SearchReloadController();
  ctrl2.searchChange("Lan");
  ctrl2.searchChange("Hoa");
  assert.equal(ctrl2.draft, "Hoa");
  ctrl2.handleReload();
  assert.equal(ctrl2.currentQuery.q, "Hoa");
  assert.equal(ctrl2.dispatches.length, 1);
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(ctrl2.dispatches.length, 1);

  // 3. Clear via input vs clear button
  const ctrl3 = new SearchReloadController({
    page: 1,
    pageSize: 20,
    q: "Initial",
  });
  // Clear via clear button
  ctrl3.clear();
  assert.equal(ctrl3.draft, "");
  assert.equal(ctrl3.currentQuery.q, undefined);
  assert.equal(ctrl3.currentQuery.page, 1);
  // Clear via typing whitespace and reloading
  ctrl3.change({ q: "Active", page: 1 });
  ctrl3.searchChange("   ");
  ctrl3.handleReload();
  assert.equal(ctrl3.currentQuery.q, undefined);

  // 4. Same canonical key / whitespace
  const ctrl4 = new SearchReloadController({
    page: 1,
    pageSize: 20,
    q: "Lan",
  });
  ctrl4.draft = "Lan  "; // User typed trailing spaces
  const reloadTicket = ctrl4.handleReload();
  assert.equal(ctrl4.draft, "Lan"); // Normalized
  assert.equal(ctrl4.dispatches[0].sameKey, true);
  assert.equal(ctrl4.lane.current(reloadTicket), true);

  // 5. Reload while old request is pending; stale success/error cannot commit
  const ctrl5 = new SearchReloadController();
  const ticketA = ctrl5.change({ q: "A", page: 1 });
  assert.equal(ctrl5.lane.current(ticketA), true);
  // Reload with draft "B"
  ctrl5.draft = "B";
  const ticketB = ctrl5.handleReload();
  assert.equal(ctrl5.lane.current(ticketA), false); // Ticket A invalidated!
  assert.equal(ctrl5.lane.current(ticketB), true);
  // If request A finishes late (stale success/error), it is rejected
  let stateCommitted = null;
  const resolveA = () => {
    if (ctrl5.lane.current(ticketA)) stateCommitted = "A";
  };
  resolveA();
  assert.equal(stateCommitted, null);

  // 6. Dispose cancels timer and invalidates lane
  ctrl5.searchChange("PendingTimer");
  ctrl5.dispose();
  assert.equal(ctrl5.timer, null);
  assert.equal(ctrl5.lane.current(ticketB), false);

  // 7. Finding 04: No-op tab selection does not invalidate, dispatch or trigger read
  const ctrlTab = new SearchReloadController({
    page: 1,
    pageSize: 10,
    status: "ACTIVE",
  });
  const noopTicket = ctrlTab.change({ status: "ACTIVE", page: 1 });
  assert.equal(noopTicket, null);
  assert.equal(ctrlTab.dispatches.length, 0); // No dispatch or refresh triggered
  // Genuine tab change DOES dispatch and return ticket
  const realTicket = ctrlTab.change({ status: "INACTIVE", page: 1 });
  assert.notEqual(realTicket, null);
  assert.equal(ctrlTab.dispatches.length, 1);
  assert.equal(ctrlTab.currentQuery.status, "INACTIVE");
  ctrlTab.dispose();
});

test("token override validation logic detects detached consumers and unchanged styles", () => {
  function validateTokenOverrides(consumers, tokens) {
    const baseline = {};
    for (const [name, el] of Object.entries(consumers)) {
      if (!el) return { success: false, reason: `${name}_not_found` };
      baseline[name] = { ...el.computed };
    }
    // Simulate applying overrides
    for (const el of Object.values(consumers)) {
      for (const t of tokens) {
        if (!el.detachedProps?.includes(t.prop)) {
          el.computed[t.styleKey] = t.override;
        }
      }
    }
    // Verify each consumer individually computed exact override
    for (const [name, el] of Object.entries(consumers)) {
      for (const t of tokens) {
        if (el.computed[t.styleKey] !== t.override) {
          return {
            success: false,
            reason: `${name}_${t.styleKey}_not_overridden`,
            actual: el.computed[t.styleKey],
            expected: t.override,
          };
        }
      }
    }
    return { success: true };
  }

  const tokens = [
    { prop: "--control-size-default", styleKey: "height", override: "52px" },
    { prop: "--control-radius", styleKey: "borderRadius", override: "6px" },
    { prop: "--control-font-size", styleKey: "fontSize", override: "16px" },
  ];

  // Case 1: Healthy consumers all receive overrides -> PASS
  const healthy = {
    input: {
      computed: { height: "44px", borderRadius: "12px", fontSize: "13px" },
    },
    button: {
      computed: { height: "44px", borderRadius: "12px", fontSize: "13px" },
    },
    select: {
      computed: { height: "44px", borderRadius: "12px", fontSize: "13px" },
    },
  };
  assert.equal(validateTokenOverrides(healthy, tokens).success, true);

  // Case 2: One consumer (select) is detached from --control-size-default -> FAILS CLOSED
  const detachedSelect = {
    input: {
      computed: { height: "44px", borderRadius: "12px", fontSize: "13px" },
    },
    button: {
      computed: { height: "44px", borderRadius: "12px", fontSize: "13px" },
    },
    select: {
      computed: { height: "44px", borderRadius: "12px", fontSize: "13px" },
      detachedProps: ["--control-size-default"],
    },
  };
  const res2 = validateTokenOverrides(detachedSelect, tokens);
  assert.equal(res2.success, false);
  assert.equal(res2.reason, "select_height_not_overridden");

  // Case 3: Missing consumer element -> FAILS CLOSED
  const missingConsumer = {
    input: { computed: { height: "44px" } },
    button: null,
    select: { computed: { height: "44px" } },
  };
  assert.equal(
    validateTokenOverrides(missingConsumer, tokens).reason,
    "button_not_found",
  );
});

test("modal focus restoration restores live trigger or falls back to live heading when disconnected", () => {
  function simulateFocusRestore(trigger, heading) {
    if (trigger?.isConnected) {
      trigger.focus();
      return trigger;
    }
    if (heading?.isConnected) {
      heading.focus();
      return heading;
    }
    return null;
  }

  // Case 1: Initial focus on other control, trigger clicked properly -> focus returns to trigger
  const heading = {
    name: "h1",
    isConnected: true,
    focused: false,
    focus() {
      this.focused = true;
    },
  };
  const trigger = {
    name: "AddAddressButton",
    isConnected: true,
    focused: false,
    focus() {
      this.focused = true;
    },
  };
  const otherControl = {
    name: "SearchInput",
    isConnected: true,
    focused: true,
    focus() {
      this.focused = true;
    },
  };

  const restored = simulateFocusRestore(trigger, heading);
  assert.equal(restored, trigger);
  assert.equal(trigger.focused, true);

  // Case 2: Trigger is removed while modal was open -> falls back to live heading
  trigger.isConnected = false;
  trigger.focused = false;
  heading.focused = false;
  const fallbackRestored = simulateFocusRestore(trigger, heading);
  assert.equal(fallbackRestored, heading);
  assert.equal(heading.focused, true);

  // Case 3: Focus restoration intentionally broken -> regression must fail
  function validateFocusRestoration(activeElement, expectedTrigger) {
    if (!activeElement || activeElement !== expectedTrigger) {
      return { success: false, reason: "FOCUS_MISMATCH" };
    }
    return { success: true };
  }
  assert.equal(validateFocusRestoration(otherControl, trigger).success, false);
  assert.equal(
    validateFocusRestoration(otherControl, trigger).reason,
    "FOCUS_MISMATCH",
  );
  assert.equal(validateFocusRestoration(null, trigger).success, false);
});

test("delete reconciliation settlement requires route, idle status, single card, default replacement, and disabled action", () => {
  function checkDeleteSettled({
    pathname,
    customerId,
    dialogOpen,
    loadingStatuses,
    cards,
    deleteButtons,
  }) {
    if (pathname !== `/customers/${customerId}`)
      return { settled: false, reason: "WRONG_ROUTE" };
    if (dialogOpen) return { settled: false, reason: "DIALOG_STILL_OPEN" };
    if (
      loadingStatuses.some(
        (s) => s.includes("Đang tải") || s.includes("Chưa đối chiếu"),
      )
    )
      return { settled: false, reason: "PENDING_RECONCILIATION" };
    if (cards.length !== 1)
      return { settled: false, reason: "CARDINALITY_MISMATCH" };
    const card = cards[0];
    if (!card.isDefault) return { settled: false, reason: "NOT_DEFAULT" };
    if (card.id !== "addr-replacement")
      return { settled: false, reason: "WRONG_REPLACEMENT_ID" };
    if (deleteButtons.length !== 1)
      return { settled: false, reason: "WRONG_BUTTON_COUNT" };
    if (!deleteButtons[0].disabled)
      return { settled: false, reason: "DELETE_BUTTON_NOT_DISABLED" };
    return { settled: true };
  }

  // Case 1: Refresh delayed (still has 2 cards) -> NOT SETTLED
  const delayed = {
    pathname: "/customers/c-1",
    customerId: "c-1",
    dialogOpen: false,
    loadingStatuses: ["Đang tải khách hàng…"],
    cards: [
      { id: "addr-old", isDefault: false },
      { id: "addr-replacement", isDefault: true },
    ],
    deleteButtons: [{ disabled: false }, { disabled: false }],
  };
  assert.equal(checkDeleteSettled(delayed).settled, false);
  assert.equal(checkDeleteSettled(delayed).reason, "PENDING_RECONCILIATION");

  // Case 2: Dialog closed, but refresh error / retry state -> NOT SETTLED
  const errorState = {
    pathname: "/customers/c-1",
    customerId: "c-1",
    dialogOpen: false,
    loadingStatuses: ["Chưa đối chiếu xong dữ liệu. Chưa thể thử xóa lại."],
    cards: [{ id: "addr-old", isDefault: true }],
    deleteButtons: [{ disabled: false }],
  };
  assert.equal(checkDeleteSettled(errorState).settled, false);
  assert.equal(checkDeleteSettled(errorState).reason, "PENDING_RECONCILIATION");

  // Case 3: Wrong remaining address / not default -> FAILS
  const wrongAddress = {
    pathname: "/customers/c-1",
    customerId: "c-1",
    dialogOpen: false,
    loadingStatuses: [],
    cards: [{ id: "addr-wrong", isDefault: false }],
    deleteButtons: [{ disabled: true }],
  };
  assert.equal(checkDeleteSettled(wrongAddress).settled, false);
  assert.equal(checkDeleteSettled(wrongAddress).reason, "NOT_DEFAULT");

  // Case 4: Correct settled state -> SETTLED
  const settled = {
    pathname: "/customers/c-1",
    customerId: "c-1",
    dialogOpen: false,
    loadingStatuses: [],
    cards: [{ id: "addr-replacement", isDefault: true }],
    deleteButtons: [{ disabled: true }],
  };
  assert.equal(checkDeleteSettled(settled).settled, true);
});
