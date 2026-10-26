import type { Stats } from "./types.ts";
import { customerStats } from "./response.ts";
export type StatisticsSnapshot = {
  scope: string;
  stats: Stats;
  generation: number;
};
export function statisticsScope(
  owner: string,
  query: { q?: string; phone?: string },
  draft = query.q ?? "",
) {
  // Phone is a conservative transport identity, never a second normalization algorithm.
  return JSON.stringify([owner, draft.trim(), query.phone?.trim() ?? ""]);
}
export function captureStatistics(
  previous: StatisticsSnapshot | undefined,
  value: unknown,
  scope: string,
  generation: number,
): StatisticsSnapshot | undefined {
  if (previous?.scope === scope && generation < previous.generation)
    return previous;
  const stats = customerStats(value);
  return stats ? { scope, stats, generation } : undefined;
}
export function visibleStatistics(
  snapshot: StatisticsSnapshot | undefined,
  scope: string,
  denied: boolean,
) {
  if (denied || snapshot?.scope !== scope) return undefined;
  return snapshot.stats;
}
