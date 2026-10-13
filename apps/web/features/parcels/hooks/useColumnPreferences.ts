"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  type ParcelColumnKey,
  type ParcelColumnDef,
  DEFAULT_VISIBLE_COLUMNS,
  PARCELS_COLUMNS_STORAGE_KEY,
  parseStoredColumns,
  serializeColumns,
  getOrderedVisibleColumns,
} from "../columns.ts";

export interface UseColumnPreferencesResult {
  visibleColumns: Set<ParcelColumnKey>;
  orderedVisibleColumns: ParcelColumnDef[];
  isColumnVisible: (key: ParcelColumnKey) => boolean;
  toggleColumn: (key: ParcelColumnKey) => void;
  resetColumns: () => void;
  isCustomized: boolean;
}

export function useColumnPreferences(): UseColumnPreferencesResult {
  // Start with canonical default columns to ensure SSR and initial client hydration match
  const [visibleColumns, setVisibleColumns] = useState<Set<ParcelColumnKey>>(
    () => new Set(DEFAULT_VISIBLE_COLUMNS),
  );

  // Read stored preferences on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PARCELS_COLUMNS_STORAGE_KEY);
      if (raw) {
        const stored = parseStoredColumns(raw);
        setVisibleColumns(stored);
      }
    } catch {
      // Storage unavailable or blocked; stay with defaults
    }
  }, []);

  const persist = useCallback((nextSet: Set<ParcelColumnKey>) => {
    setVisibleColumns(nextSet);
    try {
      localStorage.setItem(
        PARCELS_COLUMNS_STORAGE_KEY,
        serializeColumns(nextSet),
      );
    } catch {
      // Storage quota or private mode error handled gracefully
    }
  }, []);

  const toggleColumn = useCallback(
    (key: ParcelColumnKey) => {
      // Invariant: trackingNumber cannot be hidden
      if (key === "trackingNumber") return;

      setVisibleColumns((current) => {
        const next = new Set(current);
        if (next.has(key)) {
          // Prevent zero-column configurations (trackingNumber is always present so min size is 1)
          if (next.size <= 1) return current;
          next.delete(key);
        } else {
          next.add(key);
        }
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const resetColumns = useCallback(() => {
    const next = new Set<ParcelColumnKey>(DEFAULT_VISIBLE_COLUMNS);
    persist(next);
  }, [persist]);

  const isColumnVisible = useCallback(
    (key: ParcelColumnKey) => visibleColumns.has(key),
    [visibleColumns],
  );

  const orderedVisibleColumns = useMemo(
    () => getOrderedVisibleColumns(visibleColumns),
    [visibleColumns],
  );

  const isCustomized = useMemo(() => {
    if (visibleColumns.size !== DEFAULT_VISIBLE_COLUMNS.length) return true;
    for (const key of DEFAULT_VISIBLE_COLUMNS) {
      if (!visibleColumns.has(key)) return true;
    }
    return false;
  }, [visibleColumns]);

  return {
    visibleColumns,
    orderedVisibleColumns,
    isColumnVisible,
    toggleColumn,
    resetColumns,
    isCustomized,
  };
}
