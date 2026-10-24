import "./styles.css";
import localFont from "next/font/local";
const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { PRODUCT_NAME } from "@nexora/shared";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
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
