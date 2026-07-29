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
  let lo = 0; // pointer into sortedDescByPoints
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
    // window only stays open while latitude is within possible radius
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

module.exports = {
  mergeSortByPoints,
  assignBadges,
  filterByDateRangeSorted,
  findDuplicateClusters,
  mergeTimelines,
  findUpvotePairsSummingTo,
  haversineKm,
};
