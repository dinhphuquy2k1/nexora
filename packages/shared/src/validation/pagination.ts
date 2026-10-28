/** Canonical page/pageSize validation shared by API and Web; no transport errors. */
export const PaginationLimits = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE: 2147483647,
  MAX_PAGE_SIZE: 100,
  MAX_OFFSET: 2147483647,
} as const;

export function parsePositiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

export function parsePagination(
  pageValue: unknown,
  pageSizeValue: unknown,
  options: {
    defaultPage?: number;
    defaultPageSize?: number;
    maxPage?: number;
    maxPageSize?: number;
    maxOffset?: number;
  } = {},
): { page: number; pageSize: number } | null {
  const maxPage = options.maxPage ?? PaginationLimits.MAX_PAGE;
  const maxSize = options.maxPageSize ?? PaginationLimits.MAX_PAGE_SIZE;
  const maxOffset = options.maxOffset ?? PaginationLimits.MAX_OFFSET;
  const page = parsePositiveInteger(
    pageValue,
    options.defaultPage ?? PaginationLimits.DEFAULT_PAGE,
    maxPage,
  );
  const pageSize = parsePositiveInteger(
    pageSizeValue,
    options.defaultPageSize ?? PaginationLimits.DEFAULT_PAGE_SIZE,
    maxSize,
  );
  if (
    page === null ||
    pageSize === null ||
    !Number.isSafeInteger(page) ||
    !Number.isSafeInteger(pageSize) ||
    page < 1 ||
    pageSize < 1 ||
    (page - 1) * pageSize > maxOffset
  )
    return null;
  return { page, pageSize };
}
