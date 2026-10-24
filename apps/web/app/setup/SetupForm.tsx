"use client";
import { useEffect, useRef, useState, useId, type FormEvent } from "react";
import { Button, TextInput } from "@nexora/ui";
import { takeSetupToken } from "../../lib/auth/setup";
import styles from "../login/login.module.css";

export function SetupForm() {
  const token = useRef<string | null>(null),
    initialized = useRef(false);
  const [ready, setReady] = useState(false),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const id = useId();

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    token.current = takeSetupToken(window.location, window.history);
    setReady(!!token.current);
    if (!token.current)
      setError(
        "Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu quản trị viên cấp lại.",
      );
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      !token.current ||
      password.length < 8 ||
      password.length > 1024 ||
      password !== confirmation
    ) {
      setError("Mật khẩu cần 8–1024 ký tự và xác nhận phải khớp.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ token: token.current, password }),
      });
      if (response.ok) {
        token.current = null;
        setPassword("");
        setConfirmation("");
        window.location.replace("/login");
        return;
      }
      setError(
        response.status === 429
          ? "Quá nhiều yêu cầu. Vui lòng thử lại sau."
          : "Không thể thiết lập mật khẩu. Liên kết có thể đã hết hạn hoặc đã được sử dụng.",
      );
    } catch {
      setError("Không thể kết nối đến dịch vụ. Vui lòng thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {error && (
        <div role="alert" aria-live="polite" className={styles.errorBanner}>
          {error}
        </div>
      )}
      <div className={styles.fieldGroup}>
        <label htmlFor={id + "password"} className={styles.label}>
          Mật khẩu mới
        </label>
        <TextInput
          id={id + "password"}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={1024}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!ready || busy}
        />
      </div>
      <div className={styles.fieldGroup}>
        <label htmlFor={id + "confirmation"} className={styles.label}>
          Xác nhận mật khẩu
        </label>
        <TextInput
          id={id + "confirmation"}
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          disabled={!ready || busy}
        />
      </div>
      <Button
        className={styles.submitBtn}
        type="submit"
        disabled={!ready || busy}
      >
        {busy ? "Đang thiết lập..." : "Đặt mật khẩu"}
      </Button>
      <div className={styles.modeFooter}>
        <a href="/login" className={styles.modeToggleLink}>
          Trở về đăng nhập
        </a>
      </div>
    </form>
  );
}
