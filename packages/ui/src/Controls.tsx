import type { ComponentPropsWithRef, ReactNode } from "react";
import styles from "./Controls.module.css";
export type ControlSize = "default" | "medium" | "large";
export type ButtonVariant = "primary" | "secondary" | "ghost" | "emphasis";
type SizeProps = { size?: ControlSize };
export type ButtonProps = ComponentPropsWithRef<"button"> &
  SizeProps & { variant?: ButtonVariant; icon?: boolean };
export type TextInputProps = Omit<ComponentPropsWithRef<"input">, "size"> &
  SizeProps;
export type SelectProps = Omit<ComponentPropsWithRef<"select">, "size"> &
  SizeProps;
export type TextareaProps = ComponentPropsWithRef<"textarea"> & SizeProps;
export type CheckboxProps = Omit<TextInputProps, "type"> & {
  children?: ReactNode;
};
/** Same presentation for real navigation links; consumers retain native link semantics. */
export function buttonClassName(
  variant: ButtonVariant = "primary",
  icon = false,
  className = "",
) {
  return `${styles.size} ${styles.button} ${variant !== "primary" ? styles[variant] : ""} ${icon ? styles.icon : ""} ${className}`;
}
export function Button({
  className = "",
  type = "button",
  variant = "primary",
  size = "default",
  icon = false,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      data-size={size}
      data-variant={variant}
      className={buttonClassName(variant, icon, className)}
    />
  );
}
export function TextInput({
  className = "",
  size = "default",
  ...props
}: TextInputProps) {
  return (
    <input
      {...props}
      data-size={size}
      className={`${styles.size} ${styles.input} ${className}`}
    />
  );
}
export function Textarea({
  className = "",
  size = "default",
  rows = 3,
  ...props
}: TextareaProps) {
  return (
    <textarea
      {...props}
      rows={rows}
      data-size={size}
      className={`${styles.size} ${styles.textarea} ${className}`}
    />
  );
}
export function Checkbox({
  children,
  className = "",
  size = "default",
  ...props
}: CheckboxProps) {
  return (
    <label
      data-size={size}
      className={`${styles.size} ${styles.checkbox} ${className}`}
    >
      <input {...props} type="checkbox" />
      <span>{children}</span>
    </label>
  );
}
export function Select({
  className = "",
  size = "default",
  ...props
}: SelectProps) {
  return (
    <select
      {...props}
      data-size={size}
      className={`${styles.size} ${styles.input} ${props.multiple ? styles.multiple : ""} ${className}`}
    />
  );
}
