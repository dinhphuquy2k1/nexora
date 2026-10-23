import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
test("mobile navigation uses neutral modal and explicit close/route/viewport lifecycle, not a client auth guard", () => {
  const shell = source("../components/app-shell/ShellClient.tsx");
  assert.match(shell, /<Overlay/);
  assert.match(shell, /matchMedia/);
  assert.match(shell, /usePathname/);
  assert.match(shell, /Đóng menu di động/);
  assert.match(shell, /toggleRef/);
  assert.doesNotMatch(
    shell,
    /verifyServerSession|nexora_session|ShippingScopeProvider/,
  );
  assert.match(
    source("../components/app-shell/Header.tsx"),
    /<NotificationMenu/,
  );
});
