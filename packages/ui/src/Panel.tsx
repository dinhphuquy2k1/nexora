import type { ReactNode } from "react";
import styles from "./Panel.module.css";

export interface PanelProps {
  title: ReactNode;
  density?: "standard" | "compact";
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({
  title,
  children,
  className,
  density = "standard",
  actions,
}: PanelProps) {
  const panelClassName = className
    ? `${styles.panel} ${className}`
    : styles.panel;

  return (
    <section className={panelClassName} data-density={density}>
      <div className={styles.heading}>
        <h2 className={styles.title}>{title}</h2>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {children}
    </section>
  );
}
