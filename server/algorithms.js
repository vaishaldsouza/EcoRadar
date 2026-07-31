/**
 * algorithms.js
 * -----------------------------------------------------------------------
 * Every non-trivial operation in EcoRadar's backend is implemented using
 * ARRAYS + POINTERS (plain indices, no maps/sets/hashmaps for the core
 * logic). No database — data.js holds plain in-memory arrays, and this
 * file provides two-pointer / index-based algorithms to search, sort,
 * merge, and filter them.
 * -----------------------------------------------------------------------
 */

// ---------------------------------------------------------------------
// 1. MERGE SORT (two-pointer merge step) — used to rank the leaderboard
// ---------------------------------------------------------------------
function mergeSortByPoints(arr) {
  if (arr.length <= 1) return arr.slice();
  const mid = arr.length >> 1;
  const left = mergeSortByPoints(arr.slice(0, mid));
  const right = mergeSortByPoints(arr.slice(mid));
  return mergeDescending(left, right);
}

// Classic two-pointer merge: i walks `left`, j walks `right`
function mergeDescending(left, right) {
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i].points >= right[j].points) {
      result.push(left[i]);
      i++;
    } else {
      result.push(right[j]);
      j++;
    }
  }
  while (i < left.length) result.push(left[i++]);
  while (j < right.length) result.push(right[j++]);
  return result;
}

// ---------------------------------------------------------------------
// 2. LEADERBOARD BADGE-TIER BOUNDARIES — two pointers scan a sorted
//    (descending) array once to find where each badge tier starts.
// ---------------------------------------------------------------------
const BADGE_TIERS = [
  { name: "Guardian", emoji: "🌳", min: 50 },
  { name: "Sapling", emoji: "🌲", min: 25 },
  { name: "Sprout", emoji: "🌿", min: 10 },
  { name: "Seedling", emoji: "🌱", min: 0 },
];

function assignBadges(sortedDescByPoints) {
  const out = [];
  let lo = 0;
  for (const tier of BADGE_TIERS) {
    let hi = lo;
    while (hi < sortedDescByPoints.length && sortedDescByPoints[hi].points >= tier.min) {
      hi++;
    }
    for (let k = lo; k < hi; k++) {
      out.push({ ...sortedDescByPoints[k], badge: tier.emoji, badgeName: tier.name, rank: k + 1 });
    }
    lo = hi;
  }
  return out;
}

// ---------------------------------------------------------------------
// 3. DATE-RANGE FILTER (sliding window, two pointers) — issues array
//    must be pre-sorted ascending by timestamp.
// ---------------------------------------------------------------------
function filterByDateRangeSorted(sortedByDateAsc, startMs, endMs) {
  let lo = 0;
  while (lo < sortedByDateAsc.length && sortedByDateAsc[lo].createdAt < startMs) lo++;
  let hi = lo;
  while (hi < sortedByDateAsc.length && sortedByDateAsc[hi].createdAt <= endMs) hi++;
  return sortedByDateAsc.slice(lo, hi);
}

// ---------------------------------------------------------------------
// 4. DUPLICATE / NEARBY ISSUE DETECTION — sort by latitude, then run a
//    two-pointer window (i = anchor, j = scanner) so we only ever
//    compare geographically-close candidates, not all O(n^2) pairs.
// ---------------------------------------------------------------------
const LAT_DEGREE_KM = 111; // ~111km per degree latitude, good enough locally

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function findDuplicateClusters(issues, radiusKm = 0.3) {
  const sorted = issues.slice().sort((a, b) => a.lat - b.lat);
  const clusters = [];
  const visited = new Array(sorted.length).fill(false);

  for (let i = 0; i < sorted.length; i++) {
    if (visited[i]) continue;
    const cluster = [sorted[i]];
    visited[i] = true;
    let j = i + 1;
    const maxLatDelta = radiusKm / LAT_DEGREE_KM;
    while (j < sorted.length && sorted[j].lat - sorted[i].lat <= maxLatDelta) {
      if (
        !visited[j] &&
        sorted[j].category === sorted[i].category &&
        haversineKm(sorted[i].lat, sorted[i].lng, sorted[j].lat, sorted[j].lng) <= radiusKm
      ) {
        cluster.push(sorted[j]);
        visited[j] = true;
      }
      j++;
    }
    if (cluster.length > 1) clusters.push(cluster);
  }
  return clusters;
}

// ---------------------------------------------------------------------
// 5. TIMELINE MERGE — merge "resolved" and "pending" issue arrays
//    (each pre-sorted by date) into a single sorted timeline, O(n),
//    two pointers, no re-sort.
// ---------------------------------------------------------------------
function mergeTimelines(resolvedSortedAsc, pendingSortedAsc) {
  const merged = [];
  let i = 0, j = 0;
  while (i < resolvedSortedAsc.length && j < pendingSortedAsc.length) {
    if (resolvedSortedAsc[i].createdAt <= pendingSortedAsc[j].createdAt) {
      merged.push({ ...resolvedSortedAsc[i], status: "resolved" });
      i++;
    } else {
      merged.push({ ...pendingSortedAsc[j], status: "pending" });
      j++;
    }
  }
  while (i < resolvedSortedAsc.length) merged.push({ ...resolvedSortedAsc[i++], status: "resolved" });
  while (j < pendingSortedAsc.length) merged.push({ ...pendingSortedAsc[j++], status: "pending" });
  return merged;
}

// ---------------------------------------------------------------------
// 6. TWO-SUM-STYLE MATCHING — find pairs of issues whose upvote counts
//    sum to a target (e.g. for a "combine reports" admin feature).
//    Classic two-pointer on a sorted array.
// ---------------------------------------------------------------------
function findUpvotePairsSummingTo(issues, target) {
  const sorted = issues.slice().sort((a, b) => a.upvotes - b.upvotes);
  const pairs = [];
  let lo = 0, hi = sorted.length - 1;
  while (lo < hi) {
    const sum = sorted[lo].upvotes + sorted[hi].upvotes;
    if (sum === target) {
      pairs.push([sorted[lo], sorted[hi]]);
      lo++;
      hi--;
    } else if (sum < target) {
      lo++;
    } else {
      hi--;
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------
// 7. ANTI-SPAM THROTTLING — pattern: Contains Duplicate II
//
//    Scans the issues array with a single pointer (i walks backward from
//    the end, i.e. most-recent first). Within a sliding window of
//    `indexDistance` entries AND a time window of `withinMs`, we check
//    whether the same userId has already filed a report whose coordinates
//    are within 0.1 km of the new report's coordinates.
//
//    Complexity: O(min(n, indexDistance)) — bounded window scan.
//    No hashmap — plain array index arithmetic.
// ---------------------------------------------------------------------
function isSpamReport(issues, userId, lat, lng, withinMs = 10 * 60 * 1000, indexDistance = 20) {
  const now = Date.now();
  const n = issues.length;

  // Walk backward from the most recent entry, staying within the window
  for (let i = n - 1; i >= 0 && i >= n - indexDistance; i--) {
    const prev = issues[i];

    // Only inspect reports from the same user
    if (prev.userId !== userId) continue;

    // Time window check (sliding window boundary)
    if (now - prev.createdAt > withinMs) continue;

    // Coordinate proximity check — reuse existing haversineKm
    if (haversineKm(lat, lng, prev.lat, prev.lng) <= 0.1) {
      return true; // duplicate found within window
    }
  }
  return false;
}

// ---------------------------------------------------------------------
// 8. DOMINANT ISSUE TYPE PER ZONE — pattern: Majority Element (Boyer-Moore)
//
//    Given an array of issues filtered to a geographic zone, uses the
//    Boyer-Moore Voting algorithm to find a candidate majority category
//    in a single pass (O(n) time, O(1) extra space — no frequency map).
//    Then does a second O(n) pass to verify the candidate actually
//    exceeds 50% of the total (strict majority, not just plurality).
//
//    Returns { category, count, total, pct } if a majority exists,
//    or null if no single category exceeds 50%.
// ---------------------------------------------------------------------
function findMajorityCategory(issuesInZone) {
  if (issuesInZone.length === 0) return null;

  // --- Pass 1: Boyer-Moore candidate selection ---
  // Maintain a single candidate and a vote counter (no array/map).
  // When counter hits 0, the current element becomes the new candidate.
  let candidate = null;
  let count = 0;

  for (let i = 0; i < issuesInZone.length; i++) {
    const cat = issuesInZone[i].category;
    if (count === 0) {
      candidate = cat;
      count = 1;
    } else if (cat === candidate) {
      count++;
    } else {
      count--;
    }
  }

  // --- Pass 2: Verify candidate is a true majority (> 50%) ---
  let tally = 0;
  for (let i = 0; i < issuesInZone.length; i++) {
    if (issuesInZone[i].category === candidate) tally++;
  }

  const total = issuesInZone.length;
  if (tally * 2 <= total) return null; // not a strict majority

  return {
    category: candidate,
    count: tally,
    total,
    pct: Math.round((tally / total) * 100),
  };
}

// ---------------------------------------------------------------------
// 9. ONE-PASS SEVERITY TRIAGE — pattern: Dutch National Flag / Sort Colors
//
//    Partitions a copy of the issues array in a single pass into three
//    buckets: critical+high | moderate | low — without a separate sort.
//
//    Uses three pointers: lo (boundary of critical/high bucket),
//    mid (current element), hi (boundary of low bucket).
//    Elements are swapped in-place on the working copy.
//
//    Complexity: O(n) time, O(n) space (we copy to avoid mutating db).
// ---------------------------------------------------------------------

// Map each severity to a bucket index (0 = urgent, 1 = moderate, 2 = low)
function _severityBucket(issue) {
  if (issue.severity === "critical" || issue.severity === "high") return 0;
  if (issue.severity === "moderate") return 1;
  return 2; // low
}

function triagePartition(issues) {
  // Work on a shallow copy — never mutate the in-memory db array
  const arr = issues.slice();
  let lo = 0;           // next slot for bucket-0 (critical/high)
  let mid = 0;          // current element under inspection
  let hi = arr.length - 1; // next slot for bucket-2 (low), scanning from right

  while (mid <= hi) {
    const bucket = _severityBucket(arr[mid]);

    if (bucket === 0) {
      // Swap current element to the front (lo) and advance both lo and mid
      [arr[lo], arr[mid]] = [arr[mid], arr[lo]];
      lo++;
      mid++;
    } else if (bucket === 1) {
      // Already in the right middle zone — just advance mid
      mid++;
    } else {
      // bucket === 2: swap current element to the back (hi), only retreat hi
      // (don't advance mid — the swapped-in element at mid needs inspection)
      [arr[mid], arr[hi]] = [arr[hi], arr[mid]];
      hi--;
    }
  }

  return arr;
}

module.exports = {
  mergeSortByPoints,
  assignBadges,
  filterByDateRangeSorted,
  findDuplicateClusters,
  mergeTimelines,
  findUpvotePairsSummingTo,
  haversineKm,
  isSpamReport,
  findMajorityCategory,
  triagePartition,
};
