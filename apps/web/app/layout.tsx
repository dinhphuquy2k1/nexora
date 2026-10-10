import "./styles.css";
import type { ReactNode } from "react";
import { AppShell } from "../components/app-shell/AppShell.tsx";
import { PRODUCT_NAME } from "@nexora/shared";

export const metadata = {
  title: `${PRODUCT_NAME} · Quản lý vận đơn`,
  description: "Nền tảng quản lý vận đơn độc lập",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
