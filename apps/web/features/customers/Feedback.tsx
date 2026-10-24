import type { customerError } from "./errors.ts";
import styles from "./customers.module.css";
export function Feedback({
  error,
}: {
  error?: ReturnType<typeof customerError>;
}) {
  if (!error) return null;
  return (
    <p role="alert" className={styles.notice}>
      {error.message}
      {error.requestId && <span> Mã yêu cầu: {error.requestId}</span>}
    </p>
  );
}
