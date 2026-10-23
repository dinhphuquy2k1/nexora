import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import styles from "./Controls.module.css";
export function Button({
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type={type}
      className={`${styles.button} ${className}`}
    />
  );
}
export function TextInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${styles.input} ${className}`} />;
}
export function Checkbox({
  children,
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> & {
  children: ReactNode;
}) {
  return (
    <label className={`${styles.checkbox} ${className}`}>
      <input {...props} type="checkbox" />
      <span>{children}</span>
    </label>
  );
}
