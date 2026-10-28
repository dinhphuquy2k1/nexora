import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
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
  assert.match(html, /Đang cập nhật tìm kiếm/);
  assert.doesNotMatch(html, /số điện thoại đã nhập|Chọn Áp dụng/);
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

test("Finding 10: table row retains native link semantics, accessible detail links and noninteractive click navigation", () => {
  const html = render(
    React.createElement(CustomerTable, {
      ...props,
      rows: [row],
    }),
  );
  // Row has tableRow class
  assert.match(html, /class="[^"]*tableRow[^"]*"/);
  // Native Eye link exists with href pointing to /customers/one
  assert.match(
    html,
    /<a[^>]*aria-label="Xem KH000001"[^>]*href="\/customers\/one"/,
  );
  // Native code link exists with href pointing to /customers/one
  assert.match(html, /<a[^>]*href="\/customers\/one"[^>]*>KH000001<\/a>/);
  // Action buttons (Edit, Power) are separate buttons inside actionCell
  assert.match(html, /<button[^>]*aria-label="Sửa KH000001"/);
  assert.match(html, /<button[^>]*aria-label="Tạm ngừng hoạt động KH000001"/);
});

test("NEXORA-031 Finding 1 & 2: Skeleton placeholders reflect real cell roles and semantic column classes", () => {
  const html = render(
    React.createElement(CustomerTable, { ...props, loading: true }),
  );

  // Each skeleton row renders all 9 semantic data-column cells
  for (const col of [
    "detail",
    "code",
    "name",
    "phone",
    "email",
    "addresses",
    "status",
    "created",
    "actions",
  ]) {
    assert.match(html, new RegExp(`data-column="${col}"`));
  }

  // Matches corresponding real cell classes
  assert.match(html, /class="[^"]*detailCell[^"]*"[^>]*data-column="detail"/);
  assert.match(html, /class="[^"]*codeCell[^"]*"[^>]*data-column="code"/);
  assert.match(html, /class="[^"]*customerName[^"]*"[^>]*data-column="name"/);
  assert.match(html, /class="[^"]*phoneCell[^"]*"[^>]*data-column="phone"/);
  assert.match(html, /class="[^"]*emailCell[^"]*"[^>]*data-column="email"/);
  assert.match(
    html,
    /class="[^"]*addressCountCell[^"]*"[^>]*data-column="addresses"/,
  );
  assert.match(html, /class="[^"]*statusCell[^"]*"[^>]*data-column="status"/);
  assert.match(html, /class="[^"]*dateCell[^"]*"[^>]*data-column="created"/);
  assert.match(html, /class="[^"]*actionCell[^"]*"[^>]*data-column="actions"/);

  // Semantic variant classes for placeholders
  assert.match(html, /class="[^"]*skeletonCell[^"]*skeleton_detail[^"]*"/);
  assert.match(html, /class="[^"]*skeletonCell[^"]*skeleton_code[^"]*"/);
  assert.match(html, /class="[^"]*skeletonCell[^"]*skeleton_name[^"]*"/);
  assert.match(html, /class="[^"]*skeletonCell[^"]*skeleton_phone[^"]*"/);
  assert.match(html, /class="[^"]*skeletonCell[^"]*skeleton_email[^"]*"/);
  assert.match(html, /class="[^"]*skeletonCell[^"]*skeleton_addresses[^"]*"/);
  assert.match(html, /class="[^"]*skeletonCell[^"]*skeleton_status[^"]*"/);
  assert.match(html, /class="[^"]*skeletonCell[^"]*skeleton_created[^"]*"/);

  // Action column renders two action button placeholders inside actionGroup
  assert.match(
    html,
    /<div class="[^"]*actionGroup[^"]*"><span class="[^"]*skeletonCell[^"]*skeletonActionBtn[^"]*"><\/span><span class="[^"]*skeletonCell[^"]*skeletonActionBtn[^"]*"><\/span><\/div>/,
  );
});

test("NEXORA-031 Finding 1 & 2: Skeleton CSS enforces wide 85-90% placeholders and balanced margin-inline: auto", async () => {
  const css = await fs.readFile(
    new URL("../features/customers/customers.module.css", import.meta.url),
    "utf8",
  );
  // Code & Phone use 88% width
  assert.match(css, /\.skeleton_code\s*\{[^}]*width:\s*88%/);
  assert.match(css, /\.skeleton_phone\s*\{[^}]*width:\s*88%/);
  // Name & Email use 90% width
  assert.match(css, /\.skeleton_name\s*\{[^}]*width:\s*90%/);
  assert.match(css, /\.skeleton_email\s*\{[^}]*width:\s*90%/);
  // Created date uses 85% width
  assert.match(css, /\.skeleton_created\s*\{[^}]*width:\s*85%/);
  // All text placeholders use margin-inline: auto for balanced horizontal margins
  assert.match(css, /\.skeleton_code\s*\{[^}]*margin-inline:\s*auto/);
  assert.match(css, /\.skeleton_name\s*\{[^}]*margin-inline:\s*auto/);
  assert.match(css, /\.skeleton_phone\s*\{[^}]*margin-inline:\s*auto/);
  assert.match(css, /\.skeleton_email\s*\{[^}]*margin-inline:\s*auto/);
  assert.match(css, /\.skeleton_created\s*\{[^}]*margin-inline:\s*auto/);
  // Row height stability: margin-block: 0 on .skeletonCell
  assert.match(css, /\.skeletonCell\s*\{[^}]*margin-block:\s*0/);
});

test("NEXORA-031 Task 1: tableViewport decouples focus indicator from detailLink and uses neutral focus token", async () => {
  const css = await fs.readFile(
    new URL("../features/customers/customers.module.css", import.meta.url),
    "utf8",
  );
  // detailLink retains standard action focus ring
  assert.match(
    css,
    /\.detailLink:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus-ring-on-light\);[^}]*outline-offset:\s*-2px;/,
  );
  // tableViewport:focus-visible uses neutral token var(--color-primary)
  assert.match(
    css,
    /\.tableViewport:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-primary\);[^}]*outline-offset:\s*-2px;/,
  );
  // Verify tableViewport and detailLink are not grouped together
  assert.doesNotMatch(
    css,
    /\.tableViewport:focus-visible\s*,\s*\.detailLink:focus-visible/,
  );
  assert.doesNotMatch(
    css,
    /\.detailLink:focus-visible\s*,\s*\.tableViewport:focus-visible/,
  );

  // Render check: CustomerTable retains accessible attributes
  const html = render(
    React.createElement(CustomerTable, { ...props, rows: [row] }),
  );
  assert.match(
    html,
    /<div[^>]*class="[^"]*tableViewport[^"]*"[^>]*tabindex="0"[^>]*role="region"[^>]*aria-label="Bảng khách hàng có thể cuộn"/i,
  );
});

test("Customer table keeps horizontal dividers only", async () => {
  const css = await fs.readFile(
    new URL("../features/customers/customers.module.css", import.meta.url),
    "utf8",
  );
  const header = css.match(/\.table th\s*\{([^}]*)\}/)?.[1];
  const cells = css.match(/\.table td\s*\{([^}]*)\}/)?.[1];
  assert.ok(header && cells);
  for (const block of [header, cells]) {
    assert.doesNotMatch(block, /border-(?:left|right)\s*:/);
    assert.match(block, /border-bottom:\s*1px solid var\(--color-border\)/);
  }
  assert.doesNotMatch(css, /\.table (?:th|td):last-child\s*\{\s*border-right:/);
  assert.match(css, /\.tableViewport:focus-visible\s*\{[^}]*outline:/);
});

test("Customer colors use semantic tokens", async () => {
  const css = await fs.readFile(
    new URL("../features/customers/customers.module.css", import.meta.url),
    "utf8",
  );
  const tokens = await fs.readFile(
    new URL("../styles/tokens.css", import.meta.url),
    "utf8",
  );
  for (const [selector, role] of [
    ["tabDotActive", "color-status-success-dot"],
    ["tabDotInactive", "color-status-pending-dot"],
    ["chipDotActive", "color-status-success-dot"],
    ["chipDotInactive", "color-status-pending-dot"],
    ["searchIcon", "color-search-icon"],
  ]) {
    const body = css.match(
      new RegExp("\\." + selector + "\\s*\\{([^}]*)\\}"),
    )?.[1];
    assert.ok(body, selector);
    assert.match(body, new RegExp("var\\(--" + role + "\\)"), selector);
  }
  const search = css.match(/\.searchInput\s*\{([^}]*)\}/)?.[1];
  assert.ok(search);
  assert.match(search, /background-color:\s*var\(--control-bg\)/);
  assert.match(search, /border-color:\s*var\(--control-border\)/);
  for (const [role, foundation] of [
    ["color-status-success-dot", "emerald-500"],
    ["color-status-pending-dot", "gray-400"],
    ["color-search-icon", "gray-400"],
  ]) {
    assert.match(
      tokens,
      new RegExp("--" + role + ":\\s*var\\(--" + foundation + "\\)"),
    );
  }
});

test("retained rows remain visible but Edit is disabled until their read is authoritative", () => {
  const fresh = render(
    React.createElement(CustomerTable, {
      ...props,
      rows: [row],
      editUnavailable: false,
    }),
  );
  const pending = render(
    React.createElement(CustomerTable, {
      ...props,
      rows: [row],
      loading: true,
      editUnavailable: true,
    }),
  );
  const failed = render(
    React.createElement(CustomerTable, {
      ...props,
      rows: [row],
      error: { message: "GET failed" },
      editUnavailable: true,
    }),
  );
  const editButton = /<button(?=[^>]*aria-label="Sửa KH000001")[^>]*>/;
  for (const html of [pending, failed]) {
    assert.match(html, /KH000001/);
    const button = html.match(editButton)?.[0];
    assert.ok(button, "Retained row keeps Edit");
    assert.match(button, /\bdisabled(?:=""|(?=\s|>))/);
  }
  const active = fresh.match(editButton)?.[0];
  assert.ok(active);
  assert.doesNotMatch(active, /\bdisabled(?:=""|(?=\s|>))/);
});
