/**
 * Types and view constants shared by the time-horizon orchestrator and its
 * four views. The day-key helpers are re-exported from lib/time-horizon so a
 * view has one import site for everything it needs.
 */
import type { MemoStatsResponse } from "@/api";

export type TimeHorizonTab = "year" | "month" | "week" | "day";
export type DisplayMode = "calendar" | "heatmap";

export type FlareMoTimeHorizonProps = {
  stats: MemoStatsResponse;
  streak: number;
  monthLabels: Array<{ date: string; label: string }>;
  onDaySelect?: (day: string) => void;
  onNavigate?: () => void;
  hoveredDate?: string | null;
  onHoverDate?: (date: string | null) => void;
  className?: string;
};

export { parseDayKey, yearOf } from "@/lib/time-horizon";
