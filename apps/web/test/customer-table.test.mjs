import test from "node:test";
import assert from "node:assert/strict";
import { loadComponent, React, render } from "./helpers/render-component.mjs";
const { CustomerTable } = loadComponent(
  new URL("../features/customers/CustomerTable.tsx", import.meta.url).pathname,
);
const row = {
  id: "one",
  code: "KH000001",
  name: "Khách thực của response",
  phone: "+84912345678",
  email: null,
  note: null,
  status: "ACTIVE",
  statusLabel: "Đang hoạt động",
  createdAt: "2026-10-26T00:00:00Z",
  updatedAt: "2026-10-26T00:00:00Z",
};
const props = {
  rows: [],
  loading: false,
  filtered: false,
  onEdit() {},
  onClear() {},
  onRetry() {},
};
test("nine-column skeleton and real rows share persistent colgroup/header geometry", () => {
  const html = render(
    React.createElement(CustomerTable, { ...props, loading: true }),
  );
  assert.equal((html.match(/<col(?=[\s/>])/g) || []).length, 9);
  assert.equal((html.match(/<th /g) || []).length, 9);
  const body = html.match(/<tbody>(.*?)<\/tbody>/s)[1];
  assert.equal((body.match(/<tr /g) || []).length, 5);
  assert.equal((body.match(/<td/g) || []).length, 45);
  assert.doesNotMatch(body, /colSpan|colspan|Không tìm thấy|Chưa có khách/);
  assert.match(html, /aria-busy="true"/);
  const real = render(
    React.createElement(CustomerTable, { ...props, rows: [row] }),
  );
  assert.equal(
    html.match(/<colgroup>.*?<\/colgroup>/s)[0],
    real.match(/<colgroup>.*?<\/colgroup>/s)[0],
  );
  assert.match(real, /KH000001/);
});
test("same-query revalidation retains actual rows; failure exits skeleton with Retry", () => {
  const retained = render(
    React.createElement(CustomerTable, {
      ...props,
      rows: [row],
      loading: true,
    }),
  );
  assert.match(retained, /KH000001/);
  assert.doesNotMatch(retained, /data-skeleton/);
  const failed = render(
    React.createElement(CustomerTable, {
      ...props,
      error: { message: "Không thể tải" },
    }),
  );
  assert.doesNotMatch(failed, /data-skeleton/);
  assert.match(failed, /Thử tải lại/);
});

test("unapplied filter draft is explicit and never reported as successful empty", () => {
  const html = render(
    React.createElement(CustomerTable, { ...props, pendingFilter: true }),
  );
  assert.match(html, /Bộ lọc chưa áp dụng/);
  assert.doesNotMatch(
    html,
    /Chưa có khách hàng|Không tìm thấy khách hàng phù hợp/,
  );
  assert.equal((html.match(/<col(?=[\s/>])/g) || []).length, 9);
});

test("long name/email retain their complete accessible DOM contents", () => {
  const name = "N".repeat(200),
    email = "a".repeat(64) + "@" + "b".repeat(185) + ".com";
  assert.equal(email.length, 254);
  const html = render(
    React.createElement(CustomerTable, {
      ...props,
      rows: [{ ...row, name, email }],
    }),
  );
  assert.ok(html.includes(name));
  assert.ok(html.includes(email));
  assert.match(html, /aria-label="Xem KH000001"/);
});
