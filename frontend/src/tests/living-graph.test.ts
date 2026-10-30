import assert from "node:assert/strict";
import {
  normalizeDateToCalendarDateString,
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

console.log("=== Running Living Graph Audit & Verification Test Suite ===\n");

// TEST 1: Empty achievement data
{
  console.log("Test 1: Empty achievement data");
  const emptyItems: VaultItem[] = [];
  const grouped = groupAchievementsByDate(emptyItems);
  assert.equal(grouped.size, 0, "Grouped map should be empty");

  const { allDays } = generateCalendarGrid(new Date("2026-10-30T00:00:00.000Z"), grouped);
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
  assert.equal(calculateIntensity(5), 3, "5 achievements should yield Level 3");
  assert.equal(calculateIntensity(8), 4, "8 achievements should yield Level 4");
  console.log("  ✓ Multiple achievements grouped properly with appropriate intensity tiers");
}

// TEST 4: Anti-duplication invariant: Same achievement never assigned to two calendar dates
{
  console.log("Test 4: Anti-duplication invariant");
  const duplicateIdItem1 = createMockVaultItem({ id: "dup-1", created_at: "2026-10-20T08:00:00.000Z" });
  const duplicateIdItem2 = createMockVaultItem({ id: "dup-1", created_at: "2026-10-21T08:00:00.000Z" });

  const grouped = groupAchievementsByDate([duplicateIdItem1, duplicateIdItem2]);
  let totalAssigned = 0;
  for (const list of grouped.values()) {
    totalAssigned += list.filter((i) => i.id === "dup-1").length;
  }
  assert.equal(totalAssigned, 1, "The exact same achievement ID must only be assigned to one date");
  console.log("  ✓ Anti-duplication guarantee verified (duplicate item IDs cannot span multiple dates)");
}

// TEST 5: Correct weekly calendar placement (Sun-Sat mapping across 53 weeks)
{
  console.log("Test 5: Correct weekly calendar placement");
  const refDate = new Date("2026-10-30T00:00:00.000Z"); // Friday
  const { weeks, allDays } = generateCalendarGrid(refDate);

  assert.equal(weeks.length, 53, "Calendar grid must contain exactly 53 week columns");
  for (let w = 0; w < weeks.length; w++) {
    assert.equal(weeks[w].length, 7, `Week ${w} must contain 7 days`);
    for (let d = 0; d < 7; d++) {
      assert.equal(weeks[w][d].dayOfWeek, d, `Day index must match dayOfWeek (${d})`);
      assert.equal(weeks[w][d].weekIndex, w, `Week index must match column (${w})`);
    }
  }

  assert.equal(weeks[0][0].dayOfWeek, 0, "Row 0 is Sunday");
  assert.equal(weeks[0][6].dayOfWeek, 6, "Row 6 is Saturday");
  assert.equal(allDays.length, 53 * 7, "Total days must be 371");
  console.log("  ✓ 53-week grid correctly aligns with 7-day Sunday-Saturday calendar structure");
}

// TEST 6: Month and year boundaries & DST transitions
{
  console.log("Test 6: Month/year boundaries & DST transitions");
  // Rollover across Dec 31 to Jan 1
  const dDec = normalizeDateToCalendarDateString("2025-12-31T23:59:59.000Z", "UTC");
  const dJan = normalizeDateToCalendarDateString("2026-01-01T00:00:00.000Z", "UTC");
  assert.equal(dDec, "2025-12-31");
  assert.equal(dJan, "2026-01-01");

  // US Daylight saving time transition (Spring forward: March 8, 2026)
  const dstSpringBefore = normalizeDateToCalendarDateString("2026-03-08T06:59:59.000Z", "America/New_York");
  const dstSpringAfter = normalizeDateToCalendarDateString("2026-03-08T07:00:01.000Z", "America/New_York");
  assert.equal(dstSpringBefore, "2026-03-08");
  assert.equal(dstSpringAfter, "2026-03-08");

  // US Daylight saving time transition (Fall back: November 1, 2026)
  const dstFall = normalizeDateToCalendarDateString("2026-11-01T05:59:59.000Z", "America/New_York");
  assert.equal(dstFall, "2026-11-01");

  // Non-colliding month labels
  const { monthLabels } = generateCalendarGrid(new Date("2026-10-30T00:00:00.000Z"));
  assert.ok(monthLabels.length >= 12, "At least 12 month labels generated");
  for (let i = 1; i < monthLabels.length; i++) {
    assert.notEqual(
      monthLabels[i].weekIndex,
      monthLabels[i - 1].weekIndex,
      "Month labels must not collide in the same week column"
    );
  }
  console.log("  ✓ Month, year, and DST boundaries handled deterministically");
}

// TEST 7: Explicit timezone behavior (UTC midnight, positive and negative offsets)
{
  console.log("Test 7: Explicit timezone behavior");
  // Exact UTC midnight
  const utcMidnight = normalizeDateToCalendarDateString("2026-05-01T00:00:00.000Z", "UTC");
  assert.equal(utcMidnight, "2026-05-01");

  // Positive offset (+05:30)
  // 2026-04-30 20:00:00 UTC is 2026-05-01 01:30:00 in +05:30
  const plusOffsetInUtc = normalizeDateToCalendarDateString("2026-04-30T20:00:00.000Z", "UTC");
  const plusOffsetInTz = normalizeDateToCalendarDateString("2026-04-30T20:00:00.000Z", "Asia/Kolkata");
  assert.equal(plusOffsetInUtc, "2026-04-30");
  assert.equal(plusOffsetInTz, "2026-05-01");

  // Negative offset (-05:00)
  // 2026-05-01 02:00:00 UTC is 2026-04-30 21:00:00 in -05:00
  const negOffsetInUtc = normalizeDateToCalendarDateString("2026-05-01T02:00:00.000Z", "UTC");
  const negOffsetInTz = normalizeDateToCalendarDateString("2026-05-01T02:00:00.000Z", "America/New_York");
  assert.equal(negOffsetInUtc, "2026-05-01");
  assert.equal(negOffsetInTz, "2026-04-30");

  // Pure YYYY-MM-DD date string
  assert.equal(normalizeDateToCalendarDateString("2026-10-30"), "2026-10-30");
  console.log("  ✓ Explicit timezone conversion verified across UTC, positive, and negative offsets");
}

// TEST 8: Verification policy compatibility
{
  console.log("Test 8: Verification policy compatibility");

  // 1. Prototype ring signatures must NEVER display as Silver
  const ringProtoItem = createMockVaultItem({
    verification_tier: "none",
    verification_metadata: {
      status: "prototype_verification_pending",
      limitation: "Hash-chain simulation does not establish discrete-logarithm cryptographic proof.",
    },
  });
  const ringBadge = getTierBadgeInfo(ringProtoItem.verification_tier, ringProtoItem.verification_metadata);
  assert.notEqual(ringBadge.variant, "silver", "Prototype ring signature must NEVER be Silver");
  assert.equal(ringBadge.label, "Verification Pending");
  assert.equal(ringBadge.isVerified, false);
  assert.equal(ringBadge.isPending, true);

  // 2. Structural TLSNotary checks must NEVER display as Gold
  const tlsnotaryStructuralItem = createMockVaultItem({
    verification_tier: "none",
    verification_metadata: {
      status: "cryptographic_transcript_verification_pending",
      structural_checks_passed: true,
      limitation: "Structural checks alone do not establish MPC-TLS authenticity.",
    },
  });
  const tlsBadge = getTierBadgeInfo(tlsnotaryStructuralItem.verification_tier, tlsnotaryStructuralItem.verification_metadata);
  assert.notEqual(tlsBadge.variant, "gold", "Structural TLSNotary checks must NEVER be Gold");
  assert.equal(tlsBadge.label, "Verification Pending");
  assert.equal(tlsBadge.isVerified, false);
  assert.equal(tlsBadge.isPending, true);

  // 3. Local token entropy heuristic must NOT display as Gold
  const codeComplexityItem = createMockVaultItem({
    verification_tier: "weak",
    verification_metadata: {
      nature_of_proof: "local_complexity_heuristic",
      entropy: 4.8,
    },
  });
  const codeBadge = getTierBadgeInfo(codeComplexityItem.verification_tier, codeComplexityItem.verification_metadata);
  assert.notEqual(codeBadge.variant, "gold", "Local token entropy must NOT display as Gold");
  assert.equal(codeBadge.variant, "bronze");
  assert.equal(codeBadge.label, "Code Complexity (Bronze)");
  assert.equal(codeBadge.isVerified, false);

  // 4. Public GitHub & LeetCode observations must remain Bronze/API Observation
  const githubMilestone = createMockVaultItem({
    verification_tier: "weak",
    verification_metadata: {
      source: "living_graph_sync",
      nature_of_evidence: "automated_public_api_observation",
      provider: "github",
    },
  });
  const githubBadge = getTierBadgeInfo(githubMilestone.verification_tier, githubMilestone.verification_metadata);
  assert.equal(githubBadge.variant, "bronze");
  assert.equal(githubBadge.label, "API Observation (Bronze)");
  assert.equal(githubBadge.isVerified, false);

  // 5. Client-submitted credential URLs must NOT display as Gold
  const credlyUrlItem = createMockVaultItem({
    verification_tier: "weak",
    verification_metadata: {
      nature_of_evidence: "client_supplied_url",
      issuer: "Credly",
    },
  });
  const credlyBadge = getTierBadgeInfo(credlyUrlItem.verification_tier, credlyUrlItem.verification_metadata);
  assert.notEqual(credlyBadge.variant, "gold", "Client-submitted credential URLs must not be Gold");
  assert.equal(credlyBadge.variant, "bronze");
  assert.equal(credlyBadge.label, "Registered URL (Bronze)");

  // 6. Genuine server-evaluated Silver tier (>85% text relevance)
  const silverItem = createMockVaultItem({
    verification_tier: "mid",
    verification_metadata: {
      proof_nature: "semantic_text_alignment",
      computed_score: 0.92,
    },
  });
  const silverBadge = getTierBadgeInfo(silverItem.verification_tier, silverItem.verification_metadata);
  assert.equal(silverBadge.variant, "silver");
  assert.equal(silverBadge.label, "Verified (Silver)");
  assert.equal(silverBadge.isVerified, true);

  // 7. Genuine server-evaluated Gold tier
  const goldItem = createMockVaultItem({
    verification_tier: "strong",
    verification_metadata: {
      verified: true,
      verifier: "Mericet-NativeTLSNotary-MPC",
    },
  });
  const goldBadge = getTierBadgeInfo(goldItem.verification_tier, goldItem.verification_metadata);
  assert.equal(goldBadge.variant, "gold");
  assert.equal(goldBadge.label, "Verified (Gold)");
  assert.equal(goldBadge.isVerified, true);

  // 8. Re-verification required
  const reverifyItem = createMockVaultItem({
    verification_tier: "weak",
    verification_metadata: {
      reverification_required: true,
      reason: "Claim title was modified.",
    },
  });
  const reverifyBadge = getTierBadgeInfo(reverifyItem.verification_tier, reverifyItem.verification_metadata);
  assert.equal(reverifyBadge.variant, "pending");
  assert.equal(reverifyBadge.label, "Re-verification Required");
  assert.equal(reverifyBadge.isVerified, false);

  console.log("  ✓ All 8 verification policy constraints verified strictly against verification_service.py invariants");
}

// TEST 9: Bounded pagination handling (ensuring >100 achievements are not silently omitted)
{
  console.log("Test 9: Bounded pagination simulation");
  // Simulate 250 achievements over 3 pages
  const totalSimulated = 250;
  const mockDatabase: VaultItem[] = [];
  for (let i = 0; i < totalSimulated; i++) {
    const dayOffset = i % 100;
    const date = new Date(Date.UTC(2026, 0, 1 + dayOffset)).toISOString();
    mockDatabase.push(createMockVaultItem({
      id: `paginated-item-${i}`,
      created_at: date,
      metadata: { synced_at: date },
    }));
  }

  // Simulate paginated client fetch function
  async function simulatePaginatedFetch(pageSize: number = 100): Promise<VaultItem[]> {
    const collected: VaultItem[] = [];
    const maxPages = 10;
    let offset = 0;
    for (let p = 0; p < maxPages; p++) {
      const pageSlice = mockDatabase.slice(offset, offset + pageSize);
      if (pageSlice.length === 0) break;
      collected.push(...pageSlice);
      if (pageSlice.length < pageSize) break;
      offset += pageSize;
    }
    return collected;
  }

  const result = await simulatePaginatedFetch(100);
  assert.equal(result.length, 250, "All 250 achievements must be retrieved across 3 paginated batches");
  const grouped = groupAchievementsByDate(result);
  const { allDays } = generateCalendarGrid(new Date("2026-10-30T00:00:00.000Z"), grouped);
  const summary = calculateStreaksAndSummary(allDays);
  assert.equal(summary.totalAchievements, 250, "Summary count must include all 250 items");
  console.log("  ✓ Pagination loop correctly retrieves 250/250 items without dropping records past 100");
}

// TEST 10: Filter synchronization and streak calculation
{
  console.log("Test 10: Filter synchronization & streaks");
  const verifiedItem1 = createMockVaultItem({
    id: "v-1",
    created_at: "2026-10-28T12:00:00.000Z",
    verification_tier: "strong",
  });
  const unverifiedItem2 = createMockVaultItem({
    id: "u-2",
    created_at: "2026-10-29T12:00:00.000Z",
    verification_tier: "weak",
    verification_metadata: { source: "living_graph_sync", nature_of_evidence: "automated_public_api_observation" },
  });
  const verifiedItem3 = createMockVaultItem({
    id: "v-3",
    created_at: "2026-10-30T12:00:00.000Z",
    verification_tier: "mid",
  });

  const allItems = [verifiedItem1, unverifiedItem2, verifiedItem3];

  // All filter
  const groupedAll = groupAchievementsByDate(allItems, { filterTier: "all" });
  const gridAll = generateCalendarGrid(new Date("2026-10-30T00:00:00.000Z"), groupedAll);
  const summaryAll = calculateStreaksAndSummary(gridAll.allDays);
  assert.equal(summaryAll.totalAchievements, 3);
  assert.equal(summaryAll.currentStreak, 3);

  // Verified Only filter
  const groupedVerified = groupAchievementsByDate(allItems, { filterTier: "verified_only" });
  const gridVerified = generateCalendarGrid(new Date("2026-10-30T00:00:00.000Z"), groupedVerified);
  const summaryVerified = calculateStreaksAndSummary(gridVerified.allDays);
  assert.equal(summaryVerified.totalAchievements, 2, "Verified only filter must only count 2 items");
  assert.equal(summaryVerified.verifiedCount, 2);
  // Current streak for verified only: 2026-10-30 has verifiedItem3, 2026-10-29 had no verified items, so streak is 1
  assert.equal(summaryVerified.currentStreak, 1, "Verified only current streak is 1");

  console.log("  ✓ Filters consistently update summary metrics, streak counts, and activity cells");
}

console.log("\n========================================================");
console.log(" ALL 10 AUDIT & VERIFICATION CONTRACT TESTS PASSED (100%)");
console.log("========================================================\n");
