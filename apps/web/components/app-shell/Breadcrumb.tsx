"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { resolveBreadcrumbs } from "../../lib/navigation/resolve-active.ts";
import styles from "./Header.module.css";

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = resolveBreadcrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;

        if (isLast) {
          return (
            <span
              key={segment.label}
              className={styles.breadcrumbCurrent}
              aria-current="page"
            >
              {segment.label}
            </span>
          );
        }

        return (
          <span
            key={segment.label}
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <span className={styles.breadcrumbGroup}>{segment.label}</span>
            <ChevronRight
              className={styles.breadcrumbSeparator}
              aria-hidden="true"
            />
          </span>
        );
      })}
    </nav>
  );
}
