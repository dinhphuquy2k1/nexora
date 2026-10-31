"use client";

import {
  type ReactNode,
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type FocusEvent,
} from "react";
import styles from "./TabBar.module.css";

export type CssTokenReference = `var(--${string})`;

export interface TabBarItem<T extends string> {
  id: T;
  title: string;
  icon?: ReactNode;
  activeIconColor?: CssTokenReference;
  disabled?: boolean;
}

export interface TabBarProps<T extends string> {
  items: readonly TabBarItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  renderTrailing?: (
    item: TabBarItem<T>,
    state: { active: boolean },
  ) => ReactNode;
  idPrefix: string;
  panelId: string;
  ariaLabel: string;
}

function ChevronLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function TabBar<T extends string>({
  items,
  value,
  onValueChange,
  renderTrailing,
  idPrefix,
  panelId,
  ariaLabel,
}: TabBarProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const leftBtnRef = useRef<HTMLButtonElement>(null);
  const rightBtnRef = useRef<HTMLButtonElement>(null);

  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [focusedId, setFocusedId] = useState<T | null>(null);

  const checkScrollability = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 2;
    setHasOverflow(overflow);
    setCanScrollLeft(overflow && scrollLeft > 2);
    setCanScrollRight(overflow && scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  const scrollToItem = useCallback((id: T) => {
    const container = scrollRef.current;
    const el = tabRefs.current.get(id);
    if (!container || !el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (elRect.left < containerRect.left) {
      container.scrollBy({
        left: elRect.left - containerRect.left - 12,
        behavior: "smooth",
      });
    } else if (elRect.right > containerRect.right) {
      container.scrollBy({
        left: elRect.right - containerRect.right + 12,
        behavior: "smooth",
      });
    }
  }, []);

  // Update scrollability on mount, resize, and scroll events
  useEffect(() => {
    checkScrollability();
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => checkScrollability();
    el.addEventListener("scroll", handleScroll, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => checkScrollability());
      ro.observe(el);
    }

    window.addEventListener("resize", checkScrollability);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", checkScrollability);
    };
  }, [checkScrollability, items]);

  // Bring active item into view when value changes
  useEffect(() => {
    scrollToItem(value);
  }, [value, scrollToItem]);

  const handleScrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -220, behavior: "smooth" });
  };

  const handleScrollRight = () => {
    scrollRef.current?.scrollBy({ left: 220, behavior: "smooth" });
  };

  // Find enabled items for keyboard navigation
  const enabledItems = useMemo(
    () => items.filter((item) => !item.disabled),
    [items],
  );

  // Compute active roving id safely:
  // 1. If focusedId is valid and enabled, use focusedId
  // 2. Otherwise if value is valid and enabled, use value
  // 3. Otherwise fallback to first enabled item
  // 4. Otherwise null if no enabled items
  const activeRovingId = useMemo<T | null>(() => {
    if (enabledItems.length === 0) return null;
    if (focusedId && enabledItems.some((it) => it.id === focusedId)) {
      return focusedId;
    }
    if (enabledItems.some((it) => it.id === value)) {
      return value;
    }
    return enabledItems[0]?.id ?? null;
  }, [enabledItems, focusedId, value]);

  // Shift focus back to active roving tab if a focused scroll button becomes disabled or unmounted
  useEffect(() => {
    if (typeof document === "undefined") return;
    const activeEl = document.activeElement;
    const leftDisabled = !canScrollLeft;
    const rightDisabled = !canScrollRight;
    if (
      (!hasOverflow &&
        (activeEl === leftBtnRef.current ||
          activeEl === rightBtnRef.current)) ||
      (leftDisabled && activeEl === leftBtnRef.current) ||
      (rightDisabled && activeEl === rightBtnRef.current)
    ) {
      if (activeRovingId) {
        tabRefs.current.get(activeRovingId)?.focus();
      }
    }
  }, [hasOverflow, canScrollLeft, canScrollRight, activeRovingId]);

  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    currentItem: TabBarItem<T>,
  ) => {
    if (enabledItems.length === 0) return;

    const currentIndex = enabledItems.findIndex(
      (it) => it.id === currentItem.id,
    );
    let nextIndex: number;

    switch (e.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % enabledItems.length;
        break;
      case "ArrowLeft":
        nextIndex =
          (currentIndex - 1 + enabledItems.length) % enabledItems.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = enabledItems.length - 1;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (currentItem.id !== value && !currentItem.disabled) {
          onValueChange(currentItem.id);
        }
        return;
      default:
        return;
    }

    e.preventDefault();
    if (nextIndex >= 0 && nextIndex < enabledItems.length) {
      const nextItem = enabledItems[nextIndex];
      const nextBtn = tabRefs.current.get(nextItem.id);
      if (nextBtn) {
        nextBtn.focus();
        setFocusedId(nextItem.id);
        scrollToItem(nextItem.id);
      }
    }
  };

  const handleContainerBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(e.relatedTarget as Node | null)
    ) {
      setFocusedId(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className={styles.tabBar}
      onBlur={handleContainerBlur}
    >
      {hasOverflow && (
        <button
          ref={leftBtnRef}
          type="button"
          disabled={!canScrollLeft}
          className={`${styles.scrollButton} ${styles.scrollButtonLeft} ${!canScrollLeft ? styles.scrollButtonDisabled : ""}`.trim()}
          onClick={handleScrollLeft}
          aria-label="Cuộn sang trái"
          title="Cuộn sang trái"
        >
          <ChevronLeftIcon />
        </button>
      )}

      <div ref={scrollRef} className={styles.scrollTrack}>
        <div role="tablist" aria-label={ariaLabel} className={styles.tabList}>
          {items.map((item) => {
            const isActive = item.id === value;
            const isRovingFocused = item.id === activeRovingId;
            const tabId = `${idPrefix}-${item.id}`;

            return (
              <button
                key={item.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(item.id, el);
                  else tabRefs.current.delete(item.id);
                }}
                type="button"
                role="tab"
                id={tabId}
                aria-controls={panelId}
                aria-selected={isActive}
                aria-disabled={item.disabled ? "true" : undefined}
                disabled={item.disabled}
                tabIndex={isRovingFocused ? 0 : -1}
                className={`${styles.tabItem} ${isActive ? styles.tabItemActive : ""}`}
                onClick={() => {
                  if (item.disabled) return;
                  if (item.id !== value) {
                    onValueChange(item.id);
                  }
                  setFocusedId(item.id);
                }}
                onKeyDown={(e) => handleKeyDown(e, item)}
              >
                {item.icon && (
                  <span
                    className={styles.tabIcon}
                    style={
                      isActive && item.activeIconColor
                        ? { color: item.activeIconColor }
                        : undefined
                    }
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                )}
                <span className={styles.tabTitle}>{item.title}</span>
                {renderTrailing && renderTrailing(item, { active: isActive })}
                {isActive && (
                  <span className={styles.tabIndicator} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {hasOverflow && (
        <button
          ref={rightBtnRef}
          type="button"
          disabled={!canScrollRight}
          className={`${styles.scrollButton} ${styles.scrollButtonRight} ${!canScrollRight ? styles.scrollButtonDisabled : ""}`.trim()}
          onClick={handleScrollRight}
          aria-label="Cuộn sang phải"
          title="Cuộn sang phải"
        >
          <ChevronRightIcon />
        </button>
      )}
    </div>
  );
}
