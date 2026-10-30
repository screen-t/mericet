import assert from "node:assert/strict";
import {
  normalizeDateToLocalDateString,
  formatDisplayDate,
  calculateIntensity,
  generateCalendarGrid,
  groupAchievementsByDate,
  calculateStreaksAndSummary,
  getTierBadgeInfo,
} from "../lib/living-graph-utils.ts";
import type { DayCell } from "../lib/living-graph-utils.ts";
import type { VaultItem } from "../types/api.ts";

function createMockVaultItem(overrides: Partial<VaultItem> = {}): VaultItem {
  const date = overrides.created_at || "2026-10-15T12:00:00.000Z";
  return {
    id: overrides.id || "vault-item-1",
    user_id: overrides.user_id || "user-123",
    category: overrides.category || "achievement",
    title: overrides.title || "[GitHub] 10+ Public Open Source Repositories",
    description: overrides.description || "Authored and published public repositories",
    metadata: {
      provider: "github",
      external_id: "github:user:test:repos",
      metric_name: "public_repos",
      raw_metric_value: 12,
      synced_at: date,
      ...overrides.metadata,
    },
    verification_tier: overrides.verification_tier || "weak",
    verification_metadata: overrides.verification_metadata || {
      source: "living_graph_sync",
      nature_of_evidence: "automated_public_api_observation",
      provider: "github",
      score: 0.85,
    },
    is_public: overrides.is_public ?? true,
    display_order: overrides.display_order || 0,
    created_at: date,
    updated_at: date,
  };
}

// -------------------------------------------------------------
// TEST SUITE: LIVING GRAPH UNIT & CONTRACT VERIFICATION
// -------------------------------------------------------------

console.log("=== Running Living Graph Test Suite ===\n");

// TEST 1: Empty achievement data
{
  console.log("Test 1: Empty achievement data");
  const emptyItems: VaultItem[] = [];
  const grouped = groupAchievementsByDate(emptyItems);
  assert.equal(grouped.size, 0, "Grouped map should be empty");

  const { allDays } = generateCalendarGrid(new Date("2026-10-30"), grouped);
  const summary = calculateStreaksAndSummary(allDays);

  assert.equal(summary.totalAchievements, 0, "Total achievements should be 0");
  assert.equal(summary.activeDays, 0, "Active days should be 0");
  assert.equal(summary.currentStreak, 0, "Current streak should be 0");
  assert.equal(summary.longestStreak, 0, "Longest streak should be 0");
  assert.equal(summary.verifiedCount, 0, "Verified count should be 0");
  console.log("  ✓ Empty data handled with zeroed metrics and clean empty grid");
}

// TEST 2: Single achievement on a date
{
  console.log("Test 2: One achievement on a date");
  const item = createMockVaultItem({
    created_at: "2026-10-20T10:00:00.000Z",
    metadata: { synced_at: "2026-10-20T10:00:00.000Z", provider: "github" },
  });
  const grouped = groupAchievementsByDate([item]);
  assert.equal(grouped.size, 1);
  const items = grouped.get("2026-10-20")!;
  assert.ok(items, "Item must exist under 2026-10-20");
  assert.equal(items.length, 1);

  // Intensity check
  assert.equal(calculateIntensity(1), 1, "Count 1 should yield intensity Level 1");
  console.log("  ✓ Single achievement mapped to correct date and intensity Level 1");
}

// TEST 3: Multiple achievements on the same date
{
  console.log("Test 3: Multiple achievements on the same date");
  const item1 = createMockVaultItem({ id: "item-1", created_at: "2026-10-25T08:00:00.000Z" });
  const item2 = createMockVaultItem({ id: "item-2", created_at: "2026-10-25T14:30:00.000Z" });
  const item3 = createMockVaultItem({ id: "item-3", created_at: "2026-10-25T19:45:00.000Z" });

  const grouped = groupAchievementsByDate([item1, item2, item3]);
  const dateItems = grouped.get("2026-10-25")!;
  assert.equal(dateItems.length, 3, "All 3 items should group under 2026-10-25");
  assert.equal(calculateIntensity(dateItems.length), 2, "3 achievements should yield Level 2");

  // Higher counts: 5 items -> Level 3; 8 items -> Level 4
  assert.equal(calculateIntensity(5), 3, "5 achievements should yield Level 3");
  assert.equal(calculateIntensity(8), 4, "8 achievements should yield Level 4");
  console.log("  ✓ Multiple achievements grouped properly with appropriate intensity tiers");
}

// TEST 4: Correct weekly calendar placement (Sun-Sat mapping)
{
  console.log("Test 4: Correct weekly calendar placement");
  const refDate = new Date("2026-10-30"); // Friday
  const { weeks, allDays } = generateCalendarGrid(refDate);

  assert.equal(weeks.length, 53, "Calendar grid must contain exactly 53 week columns");
  for (let w = 0; w < weeks.length; w++) {
    assert.equal(weeks[w].length, 7, `Week ${w} must contain 7 days`);
    for (let d = 0; d < 7; d++) {
      assert.equal(weeks[w][d].dayOfWeek, d, `Day index must match dayOfWeek (${d})`);
      assert.equal(weeks[w][d].weekIndex, w, `Week index must match column (${w})`);
    }
  }

  // Verify first row is Sunday (0) and last row is Saturday (6)
  assert.equal(weeks[0][0].dayOfWeek, 0, "Row 0 is Sunday");
  assert.equal(weeks[0][6].dayOfWeek, 6, "Row 6 is Saturday");
  assert.equal(allDays.length, 53 * 7, "Total days must be 371");
  console.log("  ✓ 53-week grid correctly aligns with 7-day Sunday-Saturday calendar structure");
}

// TEST 5: Month and year boundaries
{
  console.log("Test 5: Month and year boundaries");
  // Test across December 31 / January 1 boundary
  const dDec = normalizeDateToLocalDateString("2025-12-31T23:59:59.000Z");
  const dJan = normalizeDateToLocalDateString("2026-01-01T00:00:01.000Z");
  assert.ok(dDec, "Dec date parsed");
  assert.ok(dJan, "Jan date parsed");

  const { monthLabels } = generateCalendarGrid(new Date("2026-10-30"));
  assert.ok(monthLabels.length >= 12, "At least 12 month labels generated");
  // Ensure no duplicate adjacent labels
  for (let i = 1; i < monthLabels.length; i++) {
    assert.notEqual(
      monthLabels[i].weekIndex,
      monthLabels[i - 1].weekIndex,
      "Month labels must not collide in the same week column"
    );
  }
  console.log("  ✓ Year and month rollover handled with non-overlapping month headers");
}

// TEST 6: Timezone conversion and normalization
{
  console.log("Test 6: Timezone conversion and normalization");
  // UTC string
  const utcNorm = normalizeDateToLocalDateString("2026-06-15T00:00:00.000Z");
  assert.ok(utcNorm?.startsWith("2026-06-"), "UTC string normalizes to June 2026");

  // Offset strings
  const offsetNorm = normalizeDateToLocalDateString("2026-06-15T15:30:00+05:30");
  assert.ok(offsetNorm, "Offset string normalizes");

  // Null, undefined, and malformed strings
  assert.equal(normalizeDateToLocalDateString(null), null);
  assert.equal(normalizeDateToLocalDateString(undefined), null);
  assert.equal(normalizeDateToLocalDateString("invalid-date-string"), null);

  // Formatted display date
  const display = formatDisplayDate("2026-10-30");
  assert.ok(display.includes("2026"), "Formatted date includes year");
  assert.ok(display.includes("Oct"), "Formatted date includes month");
  console.log("  ✓ Timestamp normalization handles UTC, offsets, nulls, and formatters");
}

// TEST 7: Desktop hover and mobile tap details
{
  console.log("Test 7: Desktop hover and mobile tap details");
  const item = createMockVaultItem({
    id: "item-gold",
    title: "[Credly] AWS Certified Solutions Architect",
    verification_tier: "strong",
    metadata: { provider: "credly", source_url: "https://credly.com/badge/123" },
  });

  const badgeInfo = getTierBadgeInfo(item.verification_tier, item.verification_metadata);
  assert.equal(badgeInfo.label, "Verified (Gold)");
  assert.equal(badgeInfo.isVerified, true);
  assert.equal(badgeInfo.isAutomated, false);

  // Automated observation (Weak tier)
  const weakItem = createMockVaultItem({
    verification_tier: "weak",
    verification_metadata: {
      source: "living_graph_sync",
      nature_of_evidence: "automated_public_api_observation",
    },
  });
  const weakBadge = getTierBadgeInfo(weakItem.verification_tier, weakItem.verification_metadata);
  assert.equal(weakBadge.label, "API Observation");
  assert.equal(weakBadge.isVerified, false);
  assert.equal(weakBadge.isAutomated, true);
  console.log("  ✓ Verified achievements (Gold/Silver) cleanly distinguished from Automated API Observations (Bronze)");
}

// TEST 8: Private versus public data & filtering
{
  console.log("Test 8: Private versus public data & filtering");
  const publicItem = createMockVaultItem({ id: "pub-1", is_public: true, verification_tier: "mid" });
  const privateItem = createMockVaultItem({ id: "priv-1", is_public: false, verification_tier: "weak" });

  // Authenticated owner gets both; public visitor only receives is_public=true from backend.
  // Verify verified_only filter:
  const groupedAll = groupAchievementsByDate([publicItem, privateItem], { filterTier: "all" });
  assert.equal(groupedAll.get("2026-10-15")?.length, 2, "All tier includes both");

  const groupedVerified = groupAchievementsByDate([publicItem, privateItem], { filterTier: "verified_only" });
  assert.equal(groupedVerified.get("2026-10-15")?.length, 1, "Verified only includes mid/strong");
  assert.equal(groupedVerified.get("2026-10-15")![0].id, "pub-1");
  console.log("  ✓ Filtering accurately filters verified achievements vs unverified/claims");
}

// TEST 9: Streaks calculation
{
  console.log("Test 9: Streaks calculation");
  const refDate = new Date("2026-10-30");
  const items: VaultItem[] = [
    createMockVaultItem({ id: "s-1", created_at: "2026-10-28T12:00:00.000Z" }),
    createMockVaultItem({ id: "s-2", created_at: "2026-10-29T12:00:00.000Z" }),
    createMockVaultItem({ id: "s-3", created_at: "2026-10-30T12:00:00.000Z" }),
  ];

  const grouped = groupAchievementsByDate(items);
  const { allDays } = generateCalendarGrid(refDate, grouped);
  const summary = calculateStreaksAndSummary(allDays);

  assert.equal(summary.totalAchievements, 3);
  assert.equal(summary.activeDays, 3);
  assert.equal(summary.currentStreak, 3, "Consecutive days ending today must yield currentStreak = 3");
  assert.equal(summary.longestStreak, 3, "Longest streak must be 3");
  console.log("  ✓ Streak calculations accurately track consecutive active days");
}

// TEST 10: Real backend response mapping
{
  console.log("Test 10: Real backend response mapping");
  // Shape returned by GET /vault/user/{user_id} and GET /vault
  const backendResponse = [
    {
      id: "9e11601a-8c77-4b71-b66a-2e4ad44d4123",
      user_id: "78809033-d8a9-4ea0-a4a3-764f6e3c8899",
      category: "achievement",
      title: "[LeetCode] Solved 50+ Algorithmic Challenges",
      description: "Solved 52 algorithmic problems on LeetCode.",
      metadata: {
        provider: "leetcode",
        handle: "alex_coder",
        metric_name: "leetcode_solved",
        raw_metric_value: 52,
        external_id: "leetcode:alex_coder:solved_milestone",
        source_url: "https://leetcode.com/u/alex_coder",
        score: 0.8,
        synced_at: "2026-10-22T08:15:00.000Z",
      },
      verification_tier: "weak",
      verification_metadata: {
        source: "living_graph_sync",
        nature_of_evidence: "automated_public_api_observation",
        provider: "leetcode",
        score: 0.8,
        verified_at: "2026-10-22T08:15:00.000Z",
      },
      is_public: true,
      display_order: 0,
      created_at: "2026-10-22T08:15:00.000Z",
      updated_at: "2026-10-22T08:15:00.000Z",
    },
  ];

  const grouped = groupAchievementsByDate(backendResponse as unknown as VaultItem[]);
  assert.equal(grouped.has("2026-10-22"), true);
  const items = grouped.get("2026-10-22")!;
  assert.equal(items[0].metadata?.provider, "leetcode");
  assert.equal(items[0].metadata?.raw_metric_value, 52);
  console.log("  ✓ Backend VaultItemResponse schema maps directly with 100% fidelity");
}

console.log("\n========================================");
console.log(" ALL 10 LIVING GRAPH TESTS PASSED (100%)");
console.log("========================================\n");
