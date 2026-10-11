import { GROUP_LABELS, NAVIGATION_ITEMS, type NavItem } from "./nav-config.ts";

export interface BreadcrumbSegment {
  readonly label: string;
  readonly href?: string;
  readonly isCurrent: boolean;
}

/**
 * Normalizes a pathname string by trimming whitespace and trailing slashes,
 * while preserving the root `/` path.
 */
export function normalizePathname(pathname: string | null | undefined): string {
  if (!pathname || typeof pathname !== "string") {
    return "/";
  }
  const trimmed = pathname.trim();
  if (trimmed === "" || trimmed === "/") {
    return "/";
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Checks if a specific navigation item is active given the current pathname.
 * Planned items or items without href are never active.
 */
export function isItemActive(
  item: NavItem,
  currentPathname: string | null | undefined,
): boolean {
  if (item.status !== "available" || !item.href) {
    return false;
  }
  const current = normalizePathname(currentPathname);
  const target = normalizePathname(item.href);

  if (target === "/") {
    return current === "/";
  }

  return current === target || current.startsWith(`${target}/`);
}

/**
 * Resolves the currently active navigation item from the current pathname.
 * Returns null if no available navigation item matches.
 */
export function resolveActiveItem(
  pathname: string | null | undefined,
  items: readonly NavItem[] = NAVIGATION_ITEMS,
): NavItem | null {
  const current = normalizePathname(pathname);

  // First check exact match
  for (const item of items) {
    if (item.status === "available" && item.href) {
      if (normalizePathname(item.href) === current) {
        return item;
      }
    }
  }

  // Second check nested prefix match (non-root only)
  for (const item of items) {
    if (item.status === "available" && item.href && item.href !== "/") {
      const target = normalizePathname(item.href);
      if (current.startsWith(`${target}/`)) {
        return item;
      }
    }
  }

  return null;
}

/**
 * Resolves breadcrumbs for a given pathname using the navigation contract.
 */
export function resolveBreadcrumbs(
  pathname: string | null | undefined,
  items: readonly NavItem[] = NAVIGATION_ITEMS,
): readonly BreadcrumbSegment[] {
  const activeItem = resolveActiveItem(pathname, items);

  if (!activeItem) {
    return [
      {
        label: GROUP_LABELS.System,
        isCurrent: false,
      },
      {
        label: "Không xác định",
        isCurrent: true,
      },
    ];
  }

  const groupLabel = GROUP_LABELS[activeItem.group] ?? activeItem.group;

  return [
    {
      label: groupLabel,
      isCurrent: false,
    },
    {
      label: activeItem.label,
      href: activeItem.href ?? undefined,
      isCurrent: true,
    },
  ];
}
