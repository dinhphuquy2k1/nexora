/** A bounded page window independent of population size. */
export function pageWindow(page: number, totalPages: number): number[] {
  const last = Math.max(1, totalPages);
  const current = Math.max(1, Math.min(page, last));
  return Array.from(
    new Set(
      [1, current - 1, current, current + 1, last].filter(
        (n) => n >= 1 && n <= last,
      ),
    ),
  ).sort((a, b) => a - b);
}
