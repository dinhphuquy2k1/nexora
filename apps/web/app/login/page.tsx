import { Suspense } from "react";
import { PRODUCT_NAME } from "@nexora/shared";
import { LoginForm } from "./LoginForm.tsx";
import styles from "./login.module.css";

export const metadata = {
  title: `Đăng nhập · ${PRODUCT_NAME}`,
  description: "Đăng nhập không gian quản lý vận đơn Nexora",
};

export default function LoginPage() {
  return (
    <main className={styles.container}>
      <section className={styles.card} aria-labelledby="login-heading">
        {/* Monogram Brand Mark */}
        <div className={styles.logoMonogram} aria-hidden="true">
          <span className={styles.logoLetter}>N</span>
          <span className={styles.logoDot} />
        </div>

        {/* Heading & Subtitle */}
        <h1 id="login-heading" className={styles.heading}>
          Đăng nhập {PRODUCT_NAME}
        </h1>
        <p className={styles.subtitle}>Truy cập không gian quản lý vận đơn</p>

        {/* Suspense Boundary for useSearchParams */}
        <Suspense
          fallback={
            <div style={{ minHeight: "180px" }}>Đang tải biểu mẫu...</div>
          }
        >
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
