import { SetupForm } from "./SetupForm";
import styles from "../login/login.module.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Thiết lập mật khẩu · Nexora",
  referrer: "no-referrer",
};
export default function SetupPage() {
  return (
    <main className={styles.container}>
      <section className={styles.card} aria-labelledby="setup-heading">
        <h1 id="setup-heading" className={styles.heading}>
          Thiết lập mật khẩu Nexora
        </h1>
        <p className={styles.subtitle}>
          Tạo mật khẩu riêng cho tài khoản của bạn. Liên kết chỉ sử dụng một
          lần.
        </p>
        <SetupForm />
      </section>
    </main>
  );
}
