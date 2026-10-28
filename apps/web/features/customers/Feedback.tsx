import type { customerError } from "./errors.ts";
import styles from "./customers.module.css";
export function Feedback({
  error,
  live,
}: {
  error?: ReturnType<typeof customerError> & { announced?: boolean };
  live?: boolean;
}) {
  if (!error) return null;
  return (
    <p
      data-customer-error="true"
      role={(live ?? !error.announced) ? "alert" : undefined}
      className={styles.notice}
    >
      {error.message}
      {error.requestId && <span> Mã yêu cầu: {error.requestId}</span>}
    </p>
  );
}
