import "./styles.css";
import type { ReactNode } from "react";
import { PRODUCT_NAME } from "@nexora/shared";

export const metadata = {
  title: `${PRODUCT_NAME} · Quản lý vận đơn`,
  description: "Nền tảng quản lý vận đơn độc lập",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
