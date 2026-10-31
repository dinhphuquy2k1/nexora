// Isolated browser-test entry only. Never imported by production routes.
import { createRoot } from "react-dom/client";
import { AccountMenu } from "../../components/app-shell/AccountMenu.tsx";
import { NotificationMenu } from "../../components/app-shell/NotificationMenu.tsx";
import "../../app/styles.css";
const username =
  new URLSearchParams(location.search).get("username") ?? "account_fixture";
createRoot(document.getElementById("fixture-root")!).render(
  <>
    <header
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 12,
        padding: "0 16px",
        background: "white",
      }}
    >
      <NotificationMenu />
      <AccountMenu
        initialUser={{ id: "isolated-account-fixture", username }}
        deployment={{
          badge: "Cục bộ",
          session: "Fixture only",
          runtime: "Fixture only",
        }}
      />
    </header>
    <main>
      <p>
        Môi trường kiểm thử Account Menu cô lập; không phải phiên production.
      </p>
      <button type="button" data-account-outside>
        Ngoài tài khoản
      </button>
    </main>
  </>,
);
