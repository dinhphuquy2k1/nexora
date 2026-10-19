import "./styles.css";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { PRODUCT_NAME } from "@nexora/shared";
const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  style: "normal",
  display: "swap",
});

export const metadata = {
  title: `${PRODUCT_NAME} · Quản lý vận đơn`,
  description: "Nền tảng quản lý vận đơn độc lập",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
