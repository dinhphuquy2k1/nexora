import test from "node:test";
import assert from "node:assert/strict";
import { loadComponent, React, render } from "./helpers/render-component.mjs";
const components = () =>
  loadComponent(
    new URL("../components/app-shell/AccountMenu.tsx", import.meta.url),
  );
const user = { id: "session-owned-id", username: "alice" };
const deployment = {
  badge: "Cục bộ",
  session: "Phiên làm việc cục bộ đang hoạt động",
  runtime: "Hệ thống vận hành trong môi trường máy chủ nội bộ.",
};

test("account trigger uses actual username/initials and neutral account subtitle", () => {
  const { AccountMenu } = components();
  const html = render(
    React.createElement(AccountMenu, { initialUser: user, deployment }),
  );
  assert.match(html, /Tài khoản người dùng: alice/);
  assert.match(html, />AL<\/div>/);
  assert.match(html, /Tài khoản Nexora/);
  assert.doesNotMatch(
    html,
    /Cục bộ|Phiên làm việc|máy chủ nội bộ|VIP|NXR-8829/,
  );
  assert.match(html, /data-size="medium"/);
});

test("account content has exactly three native entries and no fake destinations/identity", () => {
  const { AccountMenuContent } = components();
  const html = render(
    React.createElement(AccountMenuContent, {
      user,
      isLoggingOut: false,
      logoutError: null,
      onLogout: () => {},
    }),
  );
  const buttons = html.match(/<(button|a)\b[^>]*>[\s\S]*?<\/\1>/g) ?? [];
  assert.equal(buttons.length, 3);
  for (const label of ["Thông tin cá nhân"]) {
    const button = buttons.find((b) => b.includes(label));
    assert.ok(button);
    assert.match(button, /disabled=""/);
    assert.match(button, /title="Chưa triển khai"/);
    assert.match(button, /aria-describedby=/);
  }
  assert.match(html, /href="\/settings\/carrier-connections"/);
  assert.equal((html.match(/<a\b/g) ?? []).length, 1);
  assert.match(html, /aria-label="Đăng xuất khỏi hệ thống"/);
  assert.match(html, /Tài khoản Nexora/);
  assert.match(html, />alice</);
  assert.doesNotMatch(
    html,
    /VIP|NXR-8829|Đặng Minh Tuấn|Số dư ví|Lịch sử giao dịch|Nạp tiền|Bảo mật &amp; Mật khẩu|Kiểm thử|máy chủ nội bộ|Cục bộ/,
  );
  assert.doesNotMatch(html, /session-owned-id/);
  assert.equal((html.match(/data-press-effect="none"/g) ?? []).length, 3);
});

test("content preserves loading disablement, safe retry error and escaped real usernames", () => {
  const { AccountMenuContent } = components();
  const loading = render(
    React.createElement(AccountMenuContent, {
      user,
      isLoggingOut: true,
      logoutError: null,
      onLogout: () => {},
    }),
  );
  assert.match(loading, /Đang đăng xuất/);
  assert.equal((loading.match(/disabled=""/g) ?? []).length, 2);
  const error = render(
    React.createElement(AccountMenuContent, {
      user: { ...user, username: "<script>real</script>" },
      isLoggingOut: false,
      logoutError: "Đăng xuất không thành công. Vui lòng thử lại.",
      onLogout: () => {},
    }),
  );
  assert.match(error, /role="alert"/);
  assert.match(error, /Vui lòng thử lại/);
  assert.doesNotMatch(error, /<script>/);
  assert.match(error, /&lt;script&gt;real/);
  assert.equal((error.match(/disabled=""/g) ?? []).length, 1);
});
