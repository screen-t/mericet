import type { VaultItem } from "../types/api";

export interface DayCell {
  date: Date;
  dateString: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 (Sun) to 6 (Sat)
  weekIndex: number; // 0 to 52
  items: VaultItem[];
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
  isToday: boolean;
}

export interface MonthLabel {
  label: string;
  weekIndex: number;
}

/**
 * Normalizes an ISO timestamp, Date object, or date string into consistent calendar "YYYY-MM-DD".
 * Avoids browser timezone drift and off-by-one errors across international date boundaries.
 */
export function normalizeDateToLocalDateString(dateInput: string | Date | undefined | null): string | null {
  if (!dateInput) return null;

  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return null;
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    const year = dateInput.getUTCFullYear();
    const month = String(dateInput.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dateInput.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Parses YYYY-MM-DD string into a clean Date at UTC midnight.
 */
export function parseLocalDateString(dateString: string): Date | null {
  if (!dateString || typeof dateString !== "string") return null;
  const parts = dateString.split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(Date.UTC(year, month, day));
}

/**
 * Formats a YYYY-MM-DD or Date object into human-readable format.
 * Example: "Tuesday, Oct 27, 2026"
 */
export function formatDisplayDate(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? parseLocalDateString(dateInput) : dateInput;
  if (!d || isNaN(d.getTime())) return typeof dateInput === "string" ? dateInput : "";

  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Derives activity intensity level from raw achievement count:
 * 0: 0 achievements
 * 1: 1 achievement
 * 2: 2-3 achievements
 * 3: 4-5 achievements
 * 4: 6+ achievements
 */
export function calculateIntensity(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

/**
 * Groups achievements by calendar date (YYYY-MM-DD) based on real backend fields:
 * - metadata.observed_at
 * - created_at
 * - metadata.synced_at
 * - verification_metadata.verified_at
 */
export function groupAchievementsByDate(
  items: VaultItem[],
  options?: {
    filterTier?: "all" | "verified_only";
    filterProvider?: string;
  }
): Map<string, VaultItem[]> {
  const map = new Map<string, VaultItem[]>();

  for (const item of items) {
    // Filter tier check
    if (options?.filterTier === "verified_only") {
      const tier = item.verification_tier?.toLowerCase();
      if (tier !== "strong" && tier !== "mid") {
        continue;
      }
    }

    // Filter provider check
    if (options?.filterProvider && options.filterProvider !== "all") {
      const meta = item.metadata || {};
      const provider = (meta.provider as string)?.toLowerCase();
      if (provider !== options.filterProvider.toLowerCase()) {
        continue;
      }
    }

    // Determine relevant event date from actual backend timestamps
    const rawDate =
      (item.metadata?.observed_at as string) ||
      item.created_at ||
      (item.metadata?.synced_at as string) ||
      (item.verification_metadata?.verified_at as string);

    const dateKey = normalizeDateToLocalDateString(rawDate);
    if (!dateKey) continue;

    const existing = map.get(dateKey) || [];
    existing.push(item);
    map.set(dateKey, existing);
  }

  return map;
}

/**
 * Builds a 53-week (7 rows x 53 columns) calendar grid ending on the Saturday of the reference week.
 * Exactly 371 calendar days mapped seamlessly to weeks and weekdays using UTC to prevent DST jitter.
 */
export function generateCalendarGrid(
  referenceDate: Date = new Date(),
  achievementsByDate: Map<string, VaultItem[]> = new Map()
): {
  weeks: DayCell[][];
  allDays: DayCell[];
  monthLabels: MonthLabel[];
} {
  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth();
  const refDay = referenceDate.getUTCDate();
  const ref = new Date(Date.UTC(refYear, refMonth, refDay));
  const todayString = normalizeDateToLocalDateString(ref)!;

  // Find the end Saturday of the current week (day 6, where 0 is Sunday)
  const currentDayOfWeek = ref.getUTCDay();
  const endSaturday = new Date(ref);
  endSaturday.setUTCDate(ref.getUTCDate() + (6 - currentDayOfWeek));

  // The grid spans 53 weeks = 53 * 7 = 371 days.
  // Start on the Sunday 53 weeks prior:
  const startSunday = new Date(endSaturday);
  startSunday.setUTCDate(endSaturday.getUTCDate() - 371 + 1);

  const weeks: DayCell[][] = [];
  const allDays: DayCell[] = [];
  const monthLabels: MonthLabel[] = [];

  let lastMonth = -1;

  for (let weekIdx = 0; weekIdx < 53; weekIdx++) {
    const weekDays: DayCell[] = [];

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dayOffset = weekIdx * 7 + dayIdx;
      const cellDate = new Date(startSunday);
      cellDate.setUTCDate(startSunday.getUTCDate() + dayOffset);

      const dateString = normalizeDateToLocalDateString(cellDate)!;
      const isFuture = cellDate.getTime() > ref.getTime();
      const isToday = dateString === todayString;

      const items = achievementsByDate.get(dateString) || [];
      const count = isFuture ? 0 : items.length;
      const intensity = isFuture ? 0 : calculateIntensity(count);

      const cell: DayCell = {
        date: cellDate,
        dateString,
        dayOfWeek: dayIdx,
        weekIndex: weekIdx,
        items: isFuture ? [] : items,
        count,
        intensity,
        isFuture,
        isToday,
      };

      weekDays.push(cell);
      allDays.push(cell);

      // Track month transitions
      if (dayIdx === 0) {
        const month = cellDate.getUTCMonth();
        if (month !== lastMonth) {
          const lastLabel = monthLabels[monthLabels.length - 1];
          if (!lastLabel || weekIdx - lastLabel.weekIndex >= 2) {
            monthLabels.push({
              label: cellDate.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
              weekIndex: weekIdx,
            });
            lastMonth = month;
          }
        }
      }
    }

    weeks.push(weekDays);
  }

  return { weeks, allDays, monthLabels };
}

/**
 * Calculates contribution metrics: total achievements, active days,
 * longest streak, and current streak.
 */
export function calculateStreaksAndSummary(days: DayCell[]): {
  totalAchievements: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  verifiedCount: number;
} {
  let totalAchievements = 0;
  let activeDays = 0;
  let verifiedCount = 0;

  // Filter only non-future days
  const validDays = days.filter((d) => !d.isFuture);

  // Map of active days
  for (const day of validDays) {
    if (day.count > 0) {
      activeDays++;
      totalAchievements += day.count;
      for (const item of day.items) {
        const tier = item.verification_tier?.toLowerCase();
        if (tier === "strong" || tier === "mid") {
          verifiedCount++;
        }
      }
    }
  }

  // Calculate streaks across chronological days
  let longestStreak = 0;
  let currentRun = 0;

  for (let i = 0; i < validDays.length; i++) {
    if (validDays[i].count > 0) {
      currentRun++;
      if (currentRun > longestStreak) {
        longestStreak = currentRun;
      }
    } else {
      currentRun = 0;
    }
  }

  // Calculate current streak backwards from today
  let currentStreak = 0;
  let todayIndex = validDays.findIndex((d) => d.isToday);
  if (todayIndex === -1) todayIndex = validDays.length - 1;

  let checkIdx = todayIndex;
  if (validDays[checkIdx]?.count === 0 && checkIdx > 0) {
    checkIdx--; // Allow streak if active yesterday
  }

  while (checkIdx >= 0 && validDays[checkIdx].count > 0) {
    currentStreak++;
    checkIdx--;
  }

  return {
    totalAchievements,
    activeDays,
    currentStreak,
    longestStreak,
    verifiedCount,
  };
}

/**
 * Returns user-facing badge formatting for verification tiers.
 * Crucially distinguishes verified achievements (Gold/Silver) from
 * automated public API observations (Bronze).
 */
export function getTierBadgeInfo(tier: string, metadata?: Record<string, unknown>) {
  const isAutomated =
    metadata?.nature_of_evidence === "automated_public_api_observation" ||
    metadata?.source === "living_graph_sync";

  switch (tier?.toLowerCase()) {
    case "strong":
      return {
        label: "Verified (Gold)",
        shortLabel: "Gold",
        isVerified: true,
        isAutomated: false,
        variant: "gold" as const,
        description: "TLSNotary cryptographically verified stats or codebase originality vector proof",
        colorClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
        badgeVariant: "default" as const,
      };
    case "mid":
      return {
        label: "Verified (Silver)",
        shortLabel: "Silver",
        isVerified: true,
        isAutomated: false,
        variant: "silver" as const,
        description: "Verified claim with >85% text relevance or P2P ring signature",
        colorClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-400/40",
        badgeVariant: "secondary" as const,
      };
    case "weak":
      return {
        label: isAutomated ? "API Observation" : "Bronze Claim",
        shortLabel: isAutomated ? "Observed" : "Bronze",
        isVerified: false,
        isAutomated: true,
        variant: "bronze" as const,
        description: isAutomated
          ? "Automated milestone observed via public third-party provider API"
          : "Client-side cryptographic commitment; awaiting verification",
        colorClass: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
        badgeVariant: "outline" as const,
      };
    default:
      return {
        label: "Unverified",
        shortLabel: "Unverified",
        isVerified: false,
        isAutomated: false,
        variant: "none" as const,
        description: "Unverified portfolio claim",
        colorClass: "bg-muted text-muted-foreground border-border",
        badgeVariant: "outline" as const,
      };
  }
}
