import type { ReactNode } from "react";
import styles from "./Panel.module.css";

export interface PanelProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, children, className }: PanelProps) {
  const panelClassName = className
    ? `${styles.panel} ${className}`
    : styles.panel;

  return (
    <section className={panelClassName}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </section>
  );
}
