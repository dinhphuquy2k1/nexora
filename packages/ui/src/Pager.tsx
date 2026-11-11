"use client";
import { Fragment, type ReactNode } from "react";
import { Button, type ButtonProps, type ButtonVariant } from "./Controls";
import styles from "./Pager.module.css";

type Navigation = "first" | "previous" | "next" | "last";
export interface PagerProps {
  page: number;
  pages: readonly number[];
  targets: Record<Navigation, number>;
  disabled: Record<Navigation | "numbers", boolean>;
  onPage: (page: number) => void;
  summary: ReactNode;
  /** Feature-owned Select and reset callback; no page-size policy in Pager. */
  pageSize?: ReactNode;
  summaryClassName?: string;
  selectedVariant: ButtonVariant;
  icons: Record<Navigation, ReactNode>;
  labels: Record<Navigation | "navigation", string> & {
    page: (page: number) => string;
  };
  currentPageKnown?: boolean;
  numberIcon?: boolean;
  numberLayout?: "grouped" | "inline";
  pressEffect?: ButtonProps["pressEffect"];
  className?: string;
  selectedClassName?: string;
  unselectedClassName?: string;
}

/** Controlled presentation only: features supply authority, targets and windows. */
export function Pager({
  page,
  pages,
  targets,
  disabled,
  onPage,
  summary,
  pageSize,
  summaryClassName,
  selectedVariant,
  icons,
  labels,
  currentPageKnown = true,
  numberIcon = false,
  numberLayout = "grouped",
  pressEffect = "scale",
  className = "",
  selectedClassName,
  unselectedClassName,
}: PagerProps) {
  const navigation = (key: Navigation) => (
    <Button
      icon
      variant="secondary"
      pressEffect={pressEffect}
      aria-label={labels[key]}
      disabled={disabled[key]}
      onClick={() => onPage(targets[key])}
    >
      {icons[key]}
    </Button>
  );
  return (
    <>
      {summaryClassName ? (
        <div className={summaryClassName}>
          {summary}
          {pageSize}
        </div>
      ) : (
        <>
          {summary}
          {pageSize}
        </>
      )}
      <nav
        aria-label={labels.navigation}
        className={`${styles.controls} ${className}`.trim()}
      >
        {navigation("first")}
        {navigation("previous")}
        {pages.map((number, index) => {
          const contents = (
            <>
              {index > 0 && number - pages[index - 1] > 1 && (
                <span
                  aria-hidden={numberLayout === "grouped" ? true : undefined}
                >
                  …
                </span>
              )}
              <Button
                icon={numberIcon}
                variant={number === page ? selectedVariant : "secondary"}
                pressEffect={pressEffect}
                className={
                  number === page ? selectedClassName : unselectedClassName
                }
                aria-label={labels.page(number)}
                aria-current={
                  currentPageKnown && number === page ? "page" : undefined
                }
                disabled={disabled.numbers}
                onClick={() => onPage(number)}
              >
                {number}
              </Button>
            </>
          );
          return numberLayout === "inline" ? (
            <Fragment key={number}>{contents}</Fragment>
          ) : (
            <span key={number} className={styles.number}>
              {contents}
            </span>
          );
        })}
        {navigation("next")}
        {navigation("last")}
      </nav>
    </>
  );
}
