"use client";

import { useMemo, useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ParcelStatus } from "../types.ts";
import { FIXTURE_PARCELS } from "../fixtures/parcels.ts";
import { ParcelListHeader } from "./ParcelListHeader.tsx";
import { ParcelStatusTabs } from "./ParcelStatusTabs.tsx";
import { ParcelSearch } from "./ParcelSearch.tsx";
import { ParcelTable } from "./ParcelTable.tsx";
import { ParcelCardList } from "./ParcelCardList.tsx";
import { ParcelPagination } from "./ParcelPagination.tsx";
import { ParcelEmptyState } from "./ParcelEmptyState.tsx";
import styles from "../parcels.module.css";

const PAGE_SIZE = 8;

export function ParcelView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // URL state extraction
  const rawStatus = searchParams.get("status");
  const activeTab: ParcelStatus =
    rawStatus &&
    [
      "incoming_departure",
      "received_departure",
      "in_transit",
      "received_destination",
      "delivered",
      "claim",
    ].includes(rawStatus)
      ? (rawStatus as ParcelStatus)
      : "all";

  const searchQuery = searchParams.get("q") || "";
  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const currentPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  // Compute status counts across entire fixture dataset
  const statusCounts = useMemo(() => {
    const counts: Record<ParcelStatus, number> = {
      all: FIXTURE_PARCELS.length,
      incoming_departure: 0,
      received_departure: 0,
      in_transit: 0,
      received_destination: 0,
      delivered: 0,
      claim: 0,
    };

    for (const item of FIXTURE_PARCELS) {
      if (counts[item.status] !== undefined) {
        counts[item.status] += 1;
      }
    }

    return counts;
  }, []);

  // Filter parcels according to active status tab and search query
  const filteredParcels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return FIXTURE_PARCELS.filter((item) => {
      // Status tab match
      if (activeTab !== "all" && item.status !== activeTab) {
        return false;
      }

      // Search match: tracking number or product name
      if (query.length > 0) {
        const matchTracking = item.trackingNumber.toLowerCase().includes(query);
        const matchProduct = item.productName.toLowerCase().includes(query);
        return matchTracking || matchProduct;
      }

      return true;
    });
  }, [activeTab, searchQuery]);

  // Pagination calculation
  const totalItems = filteredParcels.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedParcels = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredParcels.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredParcels, safeCurrentPage]);

  // URL query parameter updater
  const updateUrlParams = useCallback(
    (updates: { status?: ParcelStatus; q?: string; page?: number }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.status !== undefined) {
        if (updates.status === "all") {
          params.delete("status");
        } else {
          params.set("status", updates.status);
        }
      }

      if (updates.q !== undefined) {
        const trimmed = updates.q.trim();
        if (trimmed === "") {
          params.delete("q");
        } else {
          params.set("q", trimmed);
        }
      }

      if (updates.page !== undefined) {
        if (updates.page <= 1) {
          params.delete("page");
        } else {
          params.set("page", updates.page.toString());
        }
      }

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

      startTransition(() => {
        router.push(newUrl, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  // Interaction handlers
  const handleSelectTab = useCallback(
    (tab: ParcelStatus) => {
      updateUrlParams({ status: tab, page: 1 });
    },
    [updateUrlParams],
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      updateUrlParams({ q: query, page: 1 });
    },
    [updateUrlParams],
  );

  const handleClearSearch = useCallback(() => {
    updateUrlParams({ q: "", page: 1 });
  }, [updateUrlParams]);

  const handlePageChange = useCallback(
    (page: number) => {
      updateUrlParams({ page });
    },
    [updateUrlParams],
  );

  const handleResetFilters = useCallback(() => {
    updateUrlParams({ status: "all", q: "", page: 1 });
  }, [updateUrlParams]);

  const hasFilters = activeTab !== "all" || searchQuery.trim().length > 0;

  return (
    <section className={styles.pageContainer} aria-label="Quản lý kiện hàng lẻ">
      {/* 1. Header & Primary Action */}
      <ParcelListHeader />

      {/* 2. Status Filter Tabs */}
      <ParcelStatusTabs
        activeTab={activeTab}
        statusCounts={statusCounts}
        onSelectTab={handleSelectTab}
      />

      {/* 3. Search and Results Count Bar */}
      <ParcelSearch
        searchQuery={searchQuery}
        totalResults={totalItems}
        onSearchChange={handleSearchChange}
        onClearSearch={handleClearSearch}
      />

      {/* 4. Table / Card List / Empty State */}
      <div id="parcel-list-panel" role="region" aria-live="polite">
        {totalItems === 0 ? (
          <ParcelEmptyState
            hasFilters={hasFilters}
            onResetFilters={handleResetFilters}
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <ParcelTable parcels={paginatedParcels} />

            {/* Mobile / Tablet Responsive Card List */}
            <ParcelCardList parcels={paginatedParcels} />

            {/* 5. Pagination Bar */}
            <ParcelPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </section>
  );
}
