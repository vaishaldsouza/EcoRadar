const express = require("express");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");

const db = require("./data");
const algo = require("./algorithms");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const PORT = process.env.PORT || 5000;

// -------------------- helpers --------------------
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  return check === hash;
}
function sortAsc(arr, key) {
  return arr.slice().sort((a, b) => a[key] - b[key]);
}

// -------------------- auth --------------------
app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });
  if (db.findUserByEmail(email)) return res.status(409).json({ error: "Email already registered" });

  const user = {
    id: db.nextIds.user(),
    name,
    email,
    passwordHash: hashPassword(password),
    points: 0,
    createdAt: Date.now(),
  };
  db.users.push(user);
  res.json({ id: user.id, name: user.name, email: user.email, points: user.points });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  res.json({ id: user.id, name: user.name, email: user.email, points: user.points });
});

// -------------------- issues --------------------
app.post("/api/issues", (req, res) => {
  const { userId, title, category, severity, lat, lng } = req.body;
  const user = db.findUserById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const issue = {
    id: db.nextIds.issue(),
    userId,
    title,
    category,
    severity, // low | moderate | high | critical
    lat: Number(lat),
    lng: Number(lng),
    status: "pending",
    upvotes: 0,
    createdAt: Date.now(),
  };
  db.issues.push(issue);
  user.points += 10; // array + pointer update, no ORM save()

  res.json(issue);
});

// GET /api/issues?start=<ms>&end=<ms>  -> two-pointer sliding window filter
app.get("/api/issues", (req, res) => {
  const { start, end } = req.query;
  const byDateAsc = sortAsc(db.issues, "createdAt");

  if (start && end) {
    const windowed = algo.filterByDateRangeSorted(byDateAsc, Number(start), Number(end));
    return res.json(windowed);
  }
  res.json(byDateAsc.slice().reverse()); // newest first for default feed
});

app.post("/api/issues/:id/upvote", (req, res) => {
  const issue = db.findIssueById(Number(req.params.id));
  if (!issue) return res.status(404).json({ error: "Issue not found" });
  issue.upvotes += 1;
  res.json(issue);
});

app.post("/api/issues/:id/resolve", (req, res) => {
  const issue = db.findIssueById(Number(req.params.id));
  if (!issue) return res.status(404).json({ error: "Issue not found" });
  issue.status = "resolved";
  issue.resolvedAt = Date.now();
  res.json(issue);
});

// GET /api/issues/duplicates -> two-pointer geo clustering
app.get("/api/issues/duplicates", (req, res) => {
  const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : 0.3;
  const clusters = algo.findDuplicateClusters(db.issues, radiusKm);
  res.json(clusters);
});

// GET /api/issues/timeline -> two-pointer merge of resolved + pending
app.get("/api/issues/timeline", (req, res) => {
  const resolved = sortAsc(db.issues.filter((i) => i.status === "resolved"), "createdAt");
  const pending = sortAsc(db.issues.filter((i) => i.status === "pending"), "createdAt");
  res.json(algo.mergeTimelines(resolved, pending));
});

// GET /api/issues/matching-upvotes?target=10 -> two-pointer pair sum
app.get("/api/issues/matching-upvotes", (req, res) => {
  const target = Number(req.query.target || 0);
  res.json(algo.findUpvotePairsSummingTo(db.issues, target));
});

// -------------------- leaderboard --------------------
// GET /api/leaderboard -> merge sort (two-pointer merge) + badge tiering
app.get("/api/leaderboard", (req, res) => {
  const sorted = algo.mergeSortByPoints(db.users);
  const withBadges = algo.assignBadges(sorted).map((u) => ({
    id: u.id,
    name: u.name,
    points: u.points,
    badge: u.badge,
    badgeName: u.badgeName,
    rank: u.rank,
  }));
  res.json(withBadges);
});

// -------------------- impact dashboard --------------------
app.get("/api/impact", (req, res) => {
  let resolvedCount = 0;
  let totalUpvotes = 0;
  const byCategory = {};
  for (let i = 0; i < db.issues.length; i++) {
    const issue = db.issues[i];
    if (issue.status === "resolved") resolvedCount++;
    totalUpvotes += issue.upvotes;
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
  }
  res.json({
    totalIssues: db.issues.length,
    resolvedCount,
    pendingCount: db.issues.length - resolvedCount,
    totalUpvotes,
    treesSaved: resolvedCount * 3,
    wasteKgRemoved: resolvedCount * 12,
    co2eqPreventedKg: resolvedCount * 8,
    byCategory,
  });
});

// -------------------- messaging --------------------
app.post("/api/issues/:id/messages", (req, res) => {
  const issueId = Number(req.params.id);
  const { senderId, text } = req.body;
  const issue = db.findIssueById(issueId);
  if (!issue) return res.status(404).json({ error: "Issue not found" });

  const message = { id: db.nextIds.message(), issueId, senderId, text, createdAt: Date.now() };
  db.messages.push(message);
  res.json(message);
});

app.get("/api/issues/:id/messages", (req, res) => {
  const issueId = Number(req.params.id);
  const thread = db.messages.filter((m) => m.issueId === issueId);
  res.json(sortAsc(thread, "createdAt"));
});

app.listen(PORT, () => {
  console.log(`EcoRadar server running on port ${PORT}`);
});
