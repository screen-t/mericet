import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { backendApi } from "@/lib/backend-api";
import { VaultItem } from "@/types/api";
import { useToast } from "@/hooks/use-toast";
import {
  generateCalendarGrid,
  groupAchievementsByDate,
  calculateStreaksAndSummary,
  formatDisplayDate,
  getTierBadgeInfo,
} from "@/lib/living-graph-utils";
import {
  Activity,
  Flame,
  CheckCircle2,
  Calendar as CalendarIcon,
  RefreshCw,
  Award,
  ShieldCheck,
  Code2,
  ExternalLink,
  Github,
  AlertCircle,
  X,
  Info,
} from "lucide-react";

export interface LivingGraphProps {
  userId: string;
  isOwnProfile: boolean;
  className?: string;
}

/**
 * Returns color classes for each activity intensity level.
 * Designed to look crisp and subtle in both light and dark themes.
 */
function getIntensityColorClass(intensity: number, isFuture: boolean, isSelected: boolean): string {
  if (isFuture) {
    return "bg-transparent border-transparent opacity-0 pointer-events-none";
  }

  const selectedBorder = isSelected ? "ring-2 ring-primary ring-offset-1 z-10" : "";

  switch (intensity) {
    case 1:
      return `bg-emerald-200 dark:bg-emerald-950/80 border-emerald-300/60 dark:border-emerald-800/60 hover:bg-emerald-300 dark:hover:bg-emerald-900 ${selectedBorder}`;
    case 2:
      return `bg-emerald-400 dark:bg-emerald-700/90 border-emerald-500/60 dark:border-emerald-600/60 hover:bg-emerald-500 dark:hover:bg-emerald-600 ${selectedBorder}`;
    case 3:
      return `bg-emerald-600 dark:bg-emerald-500 border-emerald-700/70 dark:border-emerald-400/70 hover:bg-emerald-700 dark:hover:bg-emerald-400 text-white ${selectedBorder}`;
    case 4:
      return `bg-emerald-800 dark:bg-emerald-400 border-emerald-900 dark:border-emerald-300 hover:bg-emerald-900 dark:hover:bg-emerald-300 text-white ${selectedBorder}`;
    default:
      return `bg-muted/40 dark:bg-muted/20 border-border/40 hover:bg-muted/70 dark:hover:bg-muted/40 ${selectedBorder}`;
  }
}

/**
 * Returns an appropriate icon for an achievement's provider.
 */
function getProviderIcon(provider?: string) {
  switch (provider?.toLowerCase()) {
    case "github":
      return <Github className="w-3.5 h-3.5" />;
    case "leetcode":
      return <Code2 className="w-3.5 h-3.5" />;
    case "credly":
      return <Award className="w-3.5 h-3.5" />;
    default:
      return <Activity className="w-3.5 h-3.5" />;
  }
}

export const LivingGraph = ({ userId, isOwnProfile, className = "" }: LivingGraphProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<"all" | "verified_only">("all");
  const [filterProvider, setFilterProvider] = useState<string>("all");

  // Fetch verified achievements from authorized Vault endpoint with bounded pagination
  const {
    data: achievements = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<VaultItem[]>({
    queryKey: ["living-graph", userId, isOwnProfile],
    queryFn: async () => {
      const PAGE_SIZE = 100;
      const MAX_PAGES = 10; // Bounded safety limit (up to 1,000 milestones)
      const collected: VaultItem[] = [];

      try {
        let offset = 0;
        for (let page = 0; page < MAX_PAGES; page++) {
          const hasToken = typeof localStorage !== "undefined" && Boolean(localStorage.getItem("access_token"));
          const batch = (isOwnProfile && hasToken)
            ? await backendApi.vault.getMyItems("achievement", PAGE_SIZE, offset)
            : await backendApi.vault.getUserItems(userId, "achievement", PAGE_SIZE, offset);

          if (!Array.isArray(batch) || batch.length === 0) {
            break;
          }

          collected.push(...batch);

          if (batch.length < PAGE_SIZE) {
            break; // Reached last page
          }

          offset += PAGE_SIZE;
        }

        if (collected.length > 0) return collected;
      } catch {
        // Fallback for legacy routes lacking category query parameter
      }

      // Fallback: paginated fetch without category parameter, filtered client-side
      let fallbackOffset = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        const hasTokenFallback = typeof localStorage !== "undefined" && Boolean(localStorage.getItem("access_token"));
        const batch = (isOwnProfile && hasTokenFallback)
          ? await backendApi.vault.getMyItems(undefined, PAGE_SIZE, fallbackOffset)
          : await backendApi.vault.getUserItems(userId, undefined, PAGE_SIZE, fallbackOffset);

        if (!Array.isArray(batch) || batch.length === 0) break;
        const filtered = batch.filter((item) => item.category === "achievement");
        collected.push(...filtered);
        if (batch.length < PAGE_SIZE) break;
        fallbackOffset += PAGE_SIZE;
      }
      return collected;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  // Living Graph sync mutation for own profile
  const syncMutation = useMutation({
    mutationFn: () => backendApi.vault.syncLivingGraph(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["living-graph", userId] });
      queryClient.invalidateQueries({ queryKey: ["vault", userId] });
      toast({
        title: "Living Graph synchronized",
        description: `Synced ${data?.result?.synced_tools ?? 0} tool(s), ${data?.result?.highlights_created ?? 0} new milestone(s).`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Sync failed",
        description: err.message || "Could not synchronize external tools",
        variant: "destructive",
      });
    },
  });

  // Group achievements by date using real backend timestamp fields
  const achievementsByDate = useMemo(() => {
    return groupAchievementsByDate(achievements, {
      filterTier,
      filterProvider,
      timeZone: "UTC",
    });
  }, [achievements, filterTier, filterProvider]);

  // Generate 53-week calendar grid
  const { weeks, allDays, monthLabels } = useMemo(() => {
    return generateCalendarGrid(new Date(), achievementsByDate);
  }, [achievementsByDate]);

  // Calculate real metrics summary
  const summary = useMemo(() => {
    return calculateStreaksAndSummary(allDays);
  }, [allDays]);

  // Selected cell data for tap details
  const selectedCell = useMemo(() => {
    if (!selectedDate) return null;
    return allDays.find((d) => d.dateString === selectedDate) || null;
  }, [selectedDate, allDays]);

  // Available providers in fetched achievements
  const availableProviders = useMemo(() => {
    const set = new Set<string>();
    achievements.forEach((item) => {
      const p = (item.metadata?.provider as string)?.toLowerCase();
      if (p) set.add(p);
    });
    return Array.from(set);
  }, [achievements]);

  // Handle cell click / tap
  const handleCellSelect = (dateString: string, isFuture: boolean) => {
    if (isFuture) return;
    setSelectedDate((prev) => (prev === dateString ? null : dateString));
  };

  return (
    <Card className={`p-4 sm:p-6 border bg-card/60 backdrop-blur-sm ${className}`}>
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              The Living Graph
            </h3>
            <Badge variant="outline" className="text-[11px] font-normal border-border">
              {summary.totalAchievements} {summary.totalAchievements === 1 ? "milestone" : "milestones"} in past year
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Continuous verifiable execution history aggregated from connected platforms and authentic accomplishments.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter: All vs Verified */}
          <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-muted/30 text-xs">
            <button
              type="button"
              onClick={() => setFilterTier("all")}
              className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
                filterTier === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterTier("verified_only")}
              className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors flex items-center gap-1 ${
                filterTier === "verified_only"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Verified Only
            </button>
          </div>

          {/* Provider selector if multiple exist */}
          {availableProviders.length > 1 && (
            <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-muted/30 text-xs">
              <button
                type="button"
                onClick={() => setFilterProvider("all")}
                className={`px-2 py-1 rounded-[4px] font-medium transition-colors ${
                  filterProvider === "all"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {availableProviders.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFilterProvider(p)}
                  className={`px-2 py-1 rounded-[4px] font-medium capitalize transition-colors ${
                    filterProvider === p
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Sync Button (for profile owner) */}
          {isOwnProfile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || isRefetching}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  syncMutation.isPending || isRefetching ? "animate-spin" : ""
                }`}
              />
              Sync
            </Button>
          )}
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <div className="p-3 rounded-lg border border-border/60 bg-muted/15 flex flex-col">
          <span className="text-[11px] text-muted-foreground">Total Achievements</span>
          <span className="text-lg sm:text-xl font-bold text-foreground mt-0.5">
            {summary.totalAchievements}
          </span>
        </div>
        <div className="p-3 rounded-lg border border-border/60 bg-muted/15 flex flex-col">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CalendarIcon className="w-3 h-3 text-primary" />
            Active Days
          </span>
          <span className="text-lg sm:text-xl font-bold text-foreground mt-0.5">
            {summary.activeDays} <span className="text-xs font-normal text-muted-foreground">/ 365</span>
          </span>
        </div>
        <div className="p-3 rounded-lg border border-border/60 bg-muted/15 flex flex-col">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            Current Streak
          </span>
          <span className="text-lg sm:text-xl font-bold text-foreground mt-0.5">
            {summary.currentStreak} <span className="text-xs font-normal text-muted-foreground">days</span>
          </span>
        </div>
        <div className="p-3 rounded-lg border border-border/60 bg-muted/15 flex flex-col">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Verified Records
          </span>
          <span className="text-lg sm:text-xl font-bold text-foreground mt-0.5">
            {summary.verifiedCount}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-3 py-6" aria-busy="true" aria-label="Loading Living Graph">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Loading milestone activity...</span>
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-[3px]">
              {Array.from({ length: 53 }).map((_, w) => (
                <div key={w} className="flex flex-col gap-[3px]">
                  {Array.from({ length: 7 }).map((_, d) => (
                    <div
                      key={d}
                      className="w-[12px] h-[12px] rounded-[2px] bg-muted/60 animate-pulse"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : isError ? (
        /* Error State */
        <div className="p-6 rounded-lg border border-destructive/30 bg-destructive/5 text-center space-y-3 my-2">
          <AlertCircle className="w-6 h-6 text-destructive mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Could not load Living Graph</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {(error as Error)?.message || "Failed to retrieve verified milestones from the backend."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </Button>
        </div>
      ) : (
        /* Main Contribution Grid (Desktop + Mobile Horizontal Scroll) */
        <div className="space-y-2">
          <TooltipProvider delayDuration={100}>
            <div
              className="overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
              tabIndex={0}
              role="region"
              aria-label="Contribution Activity Heatmap"
            >
              <div className="inline-block min-w-max select-none">
                {/* Month Labels Header */}
                <div className="flex text-[10px] text-muted-foreground mb-1.5 pl-6 font-medium">
                  {weeks.map((_, weekIdx) => {
                    const labelObj = monthLabels.find((m) => m.weekIndex === weekIdx);
                    return (
                      <div
                        key={weekIdx}
                        className="w-[12px] mr-[3px] text-left shrink-0"
                      >
                        {labelObj ? (
                          <span className="whitespace-nowrap">{labelObj.label}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Grid Rows: 7 days of week x 53 weeks */}
                <div className="flex">
                  {/* Weekday Labels (Mon, Wed, Fri) */}
                  <div className="flex flex-col justify-between pr-2 text-[10px] text-muted-foreground font-medium select-none h-[102px]">
                    <span className="h-[12px] leading-[12px] opacity-0">Sun</span>
                    <span className="h-[12px] leading-[12px]">Mon</span>
                    <span className="h-[12px] leading-[12px] opacity-0">Tue</span>
                    <span className="h-[12px] leading-[12px]">Wed</span>
                    <span className="h-[12px] leading-[12px] opacity-0">Thu</span>
                    <span className="h-[12px] leading-[12px]">Fri</span>
                    <span className="h-[12px] leading-[12px] opacity-0">Sat</span>
                  </div>

                  {/* 53 Columns of Weeks */}
                  <div className="flex gap-[3px]" role="grid" aria-label="Contribution Heatmap Grid">
                    {weeks.map((week, weekIdx) => (
                      <div key={weekIdx} className="flex flex-col gap-[3px]" role="row">
                        {week.map((cell) => {
                          const isSelected = selectedDate === cell.dateString;
                          const colorClass = getIntensityColorClass(
                            cell.intensity,
                            cell.isFuture,
                            isSelected
                          );

                          // Cell accessible label
                          const cellLabel = cell.isFuture
                            ? ""
                            : cell.count === 0
                            ? `No milestones on ${formatDisplayDate(cell.date)}`
                            : `${cell.count} ${
                                cell.count === 1 ? "milestone" : "milestones"
                              } on ${formatDisplayDate(cell.date)}`;

                          if (cell.isFuture) {
                            return (
                              <div
                                key={cell.dateString}
                                className="w-[12px] h-[12px] rounded-[2px] opacity-0 pointer-events-none"
                                aria-hidden="true"
                              />
                            );
                          }

                          return (
                            <Tooltip key={cell.dateString}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  role="gridcell"
                                  tabIndex={0}
                                  aria-label={cellLabel}
                                  aria-selected={isSelected}
                                  onClick={() => handleCellSelect(cell.dateString, cell.isFuture)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      handleCellSelect(cell.dateString, cell.isFuture);
                                    }
                                  }}
                                  className={`w-[12px] h-[12px] rounded-[2px] border transition-transform duration-100 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-1 ${colorClass}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                sideOffset={5}
                                className="p-2.5 max-w-xs text-xs space-y-1.5 shadow-lg border border-border bg-popover"
                              >
                                <div className="font-semibold text-foreground text-xs border-b border-border/50 pb-1">
                                  {formatDisplayDate(cell.date)}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {cell.count === 0 ? (
                                    <span>No milestones recorded.</span>
                                  ) : (
                                    <span className="font-medium text-foreground">
                                      {cell.count} {cell.count === 1 ? "milestone" : "milestones"}
                                    </span>
                                  )}
                                </div>
                                {cell.items.length > 0 && (
                                  <div className="space-y-1.5 pt-1">
                                    {cell.items.slice(0, 3).map((item) => {
                                      const tierInfo = getTierBadgeInfo(
                                        item.verification_tier,
                                        item.verification_metadata
                                      );
                                      return (
                                        <div
                                          key={item.id}
                                          className="text-[11px] space-y-0.5 border-l-2 border-primary/50 pl-1.5"
                                        >
                                          <div className="font-medium text-foreground line-clamp-1">
                                            {item.title}
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <Badge
                                              variant={tierInfo.badgeVariant}
                                              className={`text-[9px] px-1 py-0 h-4 ${tierInfo.colorClass}`}
                                            >
                                              {tierInfo.label}
                                            </Badge>
                                            {item.metadata?.provider && (
                                              <span className="text-[10px] text-muted-foreground capitalize">
                                                {String(item.metadata.provider)}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {cell.items.length > 3 && (
                                      <p className="text-[10px] text-muted-foreground italic">
                                        + {cell.items.length - 3} more (tap cell to view all)
                                      </p>
                                    )}
                                  </div>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TooltipProvider>

          {/* Grid Footer: Activity Intensity Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground pt-1 gap-2 border-t border-border/40">
            <div className="text-[11px]">
              Tap or click any block to view day milestones.
            </div>
            <div className="flex items-center gap-1.5 self-end sm:self-auto text-[11px]">
              <span>Less</span>
              <div
                className="w-[11px] h-[11px] rounded-[2px] bg-muted/40 dark:bg-muted/20 border border-border/40"
                title="Level 0: 0 milestones"
              />
              <div
                className="w-[11px] h-[11px] rounded-[2px] bg-emerald-200 dark:bg-emerald-950/80 border border-emerald-300/60 dark:border-emerald-800/60"
                title="Level 1: 1 milestone"
              />
              <div
                className="w-[11px] h-[11px] rounded-[2px] bg-emerald-400 dark:bg-emerald-700/90 border border-emerald-500/60 dark:border-emerald-600/60"
                title="Level 2: 2-3 milestones"
              />
              <div
                className="w-[11px] h-[11px] rounded-[2px] bg-emerald-600 dark:bg-emerald-500 border border-emerald-700/70 dark:border-emerald-400/70"
                title="Level 3: 4-5 milestones"
              />
              <div
                className="w-[11px] h-[11px] rounded-[2px] bg-emerald-800 dark:bg-emerald-400 border border-emerald-900 dark:border-emerald-300"
                title="Level 4: 6+ milestones"
              />
              <span>More</span>
            </div>
          </div>
        </div>
      )}

      {/* Selected Day Details Panel (Mobile Tap & Desktop Click Inspector) */}
      {selectedCell && (
        <div className="mt-4 pt-4 border-t border-border/70 animate-in fade-in-50 duration-200">
          <div className="p-4 rounded-lg border border-border/70 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">
                    {formatDisplayDate(selectedCell.date)}
                  </h4>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {selectedCell.count} {selectedCell.count === 1 ? "milestone" : "milestones"}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(null)}
                className="h-7 w-7 p-0 rounded-full"
                aria-label="Close selected day details"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            {selectedCell.items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">
                No verified achievements or automated platform milestones were recorded on this date.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                {selectedCell.items.map((item) => {
                  const tierInfo = getTierBadgeInfo(
                    item.verification_tier,
                    item.verification_metadata
                  );
                  const provider = (item.metadata?.provider as string) || "vault";
                  const sourceUrl = (item.metadata?.source_url as string) || (item.metadata?.url as string);

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-md border border-border/70 bg-card hover:border-primary/40 transition-colors space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-foreground text-sm flex items-center gap-1.5">
                          {getProviderIcon(provider)}
                          <span className="line-clamp-1">{item.title}</span>
                        </div>
                        {sourceUrl && (
                          <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground shrink-0"
                            title="Open external milestone source"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={tierInfo.badgeVariant}
                            className={`text-[10px] px-1.5 py-0.5 ${tierInfo.colorClass}`}
                          >
                            {tierInfo.label}
                          </Badge>
                          <span className="text-muted-foreground capitalize">
                            {provider}
                          </span>
                        </div>
                        {item.metadata?.raw_metric_value !== undefined && (
                          <span className="text-muted-foreground font-mono text-[11px]">
                            Metric: {String(item.metadata.raw_metric_value)}
                          </span>
                        )}
                      </div>

                      {tierInfo.description && (
                        <p className="text-[10px] text-muted-foreground/80 leading-normal border-t border-border/20 pt-1">
                          {tierInfo.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State Banner (when user has 0 achievements recorded) */}
      {!isLoading && !isError && summary.totalAchievements === 0 && (
        <div className="mt-4 p-4 rounded-lg border border-dashed border-border text-center space-y-2 bg-muted/10">
          <Info className="w-5 h-5 text-muted-foreground mx-auto" />
          <div className="space-y-0.5">
            <p className="text-xs sm:text-sm font-medium text-foreground">
              No milestones recorded yet
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {isOwnProfile
                ? "Connect your external developer tools (GitHub, LeetCode, Credly) in the Resume Vault tab, or add achievements to see your Living Graph come alive."
                : "This user has not yet recorded or published verified milestones to their Living Graph."}
            </p>
          </div>
          {isOwnProfile && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="text-xs gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                Sync Platforms Now
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
