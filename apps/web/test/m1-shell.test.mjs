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

test("Header toggle button accessible label changes to 'Đóng menu di động' when drawer is open", () => {
  const header = source("../components/app-shell/Header.tsx");
  // Toggle label must distinguish open vs closed mobile drawer
  assert.match(
    header,
    /(?:if\s*\(\s*isMobile\s*\)[^}]*mobileOpen\s*\?\s*["']Đóng menu di động["']\s*:\s*["']Mở menu di động["']|isMobile\s*\?\s*\(?\s*mobileOpen\s*\?\s*["']Đóng menu di động["']\s*:\s*["']Mở menu di động["']\)?)/s,
    "Mobile toggle must announce 'Đóng menu di động' when drawer is open",
  );

  assert.doesNotMatch(
    header,
    /if\s*\(\s*isMobile\s*\)\s*toggleLabel\s*=\s*["']Mở menu di động["']\s*;/s,
    "Header must not unconditionally set 'Mở menu di động' when isMobile is true",
  );
});

test("Sidebar and ShellClient implement CSS-first responsive compact desktop presentation without first-paint shift", () => {
  const sidebarCss = source("../components/app-shell/Sidebar.module.css");
  assert.match(
    sidebarCss,
    /\.responsive\s*\{[^}]*width:\s*var\(--sidebar-width\)/s,
    "Sidebar CSS must define responsive default expanded width",
  );
  assert.match(
    sidebarCss,
    /@media\s*\(min-width:\s*901px\)\s*and\s*\(max-width:\s*1100px\)\s*\{[^}]*\.responsive\s*\{[^}]*width:\s*var\(--sidebar-collapsed-width\)/s,
    "Sidebar CSS must define responsive compact width (72px) at 901-1100px",
  );
  const shell = source("../components/app-shell/ShellClient.tsx");
  assert.match(
    shell,
    /userOverride/s,
    "ShellClient must explicitly separate user override from responsive default",
  );
});

test("Visual fidelity matches ZIP reference for Sidebar, Header, Login and Mobile Drawer", () => {
  // Mobile drawer uses compact icon button instead of giant orange button
  const shell = source("../components/app-shell/ShellClient.tsx");
  assert.match(shell, /mobileCloseButton/);
  assert.match(shell, /<X\s/);

  // Layout exports viewport width=device-width
  const layout = source("../app/layout.tsx");
  assert.match(
    layout,
    /viewport:\s*Viewport\s*=\s*\{[^}]*width:\s*["']device-width["']/s,
  );

  // Sidebar subtitle matches ZIP reference
  const sidebar = source("../components/app-shell/Sidebar.tsx");
  assert.match(sidebar, /Logistics Hub/);

  // Breadcrumb current item includes indicator dot
  const breadcrumb = source("../components/app-shell/Breadcrumb.tsx");
  assert.match(breadcrumb, /breadcrumbDot/);

  // Login styling aligns with ZIP reference
  const loginCss = source("../app/login/login.module.css");
  assert.match(loginCss, /\.card\s*\{[^}]*border-radius:\s*16px/s);
  assert.match(loginCss, /\.input\s*\{[^}]*background-color:\s*#f8fafc/s);
  assert.match(
    loginCss,
    /\.form button\[type=["']submit["']\]\s*\{[^}]*color:\s*#ffffff/s,
  );
});
