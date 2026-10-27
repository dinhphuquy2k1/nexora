import type { CustomerPage, Query, Stats } from "./types.ts";

/** A bounded page window independent of population size. */
export function customerPageWindow(page: number, totalPages: number): number[] {
  const last = Math.max(1, totalPages);
  const current = Math.max(1, Math.min(page, last));
  return [
    ...new Set(
      [1, current - 1, current, current + 1, last].filter(
        (n) => n >= 1 && n <= last,
      ),
    ),
  ].sort((a, b) => a - b);
}

export type PaginationModelInput = {
  query: Query;
  pagination?: CustomerPage["pagination"];
  stats?: Stats;
  rowCount: number;
  loading: boolean;
};

export type PaginationModel = {
  page: number;
  pageSize: number;
  total?: number;
  totalPages: number;
  pages: number[];
  from: number;
  to: number;
  summaryRange: string;
  summaryTotal: string;
  canPrev: boolean;
  canNext: boolean;
  canFirst: boolean;
  canLast: boolean;
  isAuthoritative: boolean;
  isEstimated: boolean;
};

export function derivePaginationModel({
  query,
  pagination,
  stats,
  rowCount,
  loading,
}: PaginationModelInput): PaginationModel {
  const isAuthoritative = pagination !== undefined;
  let total: number | undefined;
  let totalPages: number;
  let isEstimated = false;

  if (isAuthoritative) {
    total = Math.max(0, pagination.total);
    totalPages = Math.max(
      1,
      Math.min(
        pagination.totalPages,
        Math.floor(2147483647 / Math.max(1, query.pageSize)) + 1,
        2147483647,
      ),
    );
  } else if (stats !== undefined) {
    const scoped =
      query.status === "ACTIVE"
        ? stats.active
        : query.status === "INACTIVE"
          ? stats.inactive
          : stats.total;
    total = Math.max(0, scoped);
    totalPages = Math.max(
      1,
      Math.min(
        Math.ceil(total / Math.max(1, query.pageSize)),
        Math.floor(2147483647 / Math.max(1, query.pageSize)) + 1,
        2147483647,
      ),
    );
    isEstimated = true;
  } else {
    total = undefined;
    totalPages = Math.max(1, query.page);
  }

  // Authoritative responses clamp page within valid range; transitions preserve requested page.
  const page = isAuthoritative
    ? Math.max(1, Math.min(query.page, totalPages))
    : Math.max(1, query.page);

  let from = 0;
  let to = 0;
  let summaryRange = "—";
  let summaryTotal = "—";

  if (isAuthoritative) {
    summaryTotal = String(total);
    if (total === 0 || rowCount === 0) {
      from = 0;
      to = 0;
      summaryRange = "0";
    } else {
      from = (page - 1) * query.pageSize + 1;
      to = from + rowCount - 1;
      summaryRange = `${from}–${to}`;
    }
  } else if (isEstimated && total !== undefined) {
    summaryTotal = String(total);
    if (total === 0) {
      from = 0;
      to = 0;
      summaryRange = "0";
    } else {
      from = (page - 1) * query.pageSize + 1;
      to = Math.min(from + query.pageSize - 1, total);
      summaryRange = `${from}–${to}`;
    }
  }

  const pages = customerPageWindow(page, totalPages);
  // Estimated statistics stabilize presentation but are not permission to navigate.
  const canPrev = isAuthoritative && !loading && page > 1;
  const canNext = isAuthoritative && !loading && page < totalPages;
  const canFirst = isAuthoritative && !loading && page > 1;
  const canLast = isAuthoritative && !loading && page < totalPages;

  return {
    page,
    pageSize: query.pageSize,
    total,
    totalPages,
    pages,
    from,
    to,
    summaryRange,
    summaryTotal,
    canPrev,
    canNext,
    canFirst,
    canLast,
    isAuthoritative,
    isEstimated,
  };
}
