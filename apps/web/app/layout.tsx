import "./styles.css";
import Link from "next/link";
import { PRODUCT_NAME } from "@nexora/shared";
export const metadata = {
  title: "Nexora · Quản lý vận đơn",
  description: "Nền tảng quản lý vận đơn độc lập",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <aside>
          <Link href="/" className="brand">
            {PRODUCT_NAME}
            <span>QUẢN LÝ VẬN ĐƠN</span>
          </Link>
          <nav>
            <Link href="/">Tổng quan</Link>
            <Link href="/system">Trạng thái hệ thống</Link>
            <Link href="/settings">Cài đặt</Link>
          </nav>
          <p className="sidebar-note">
            Phiên bản nền tảng 0.1
            <br />
            Chạy cục bộ trên máy của bạn
          </p>
        </aside>
        <main>
          <header>
            <span>HỆ THỐNG VẬN ĐƠN</span>
            <span className="local">● Không gian cục bộ</span>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
