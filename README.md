# EcoRadar 🌍

A full-stack environmental reporting platform — its **entire data layer and core logic run on plain arrays and two-pointer algorithms**, with no database.

## Why "array + two pointers"?

Every non-trivial backend operation avoids hashmaps/ORMs and instead uses index-based array algorithms:

| Feature | Algorithm | File |
|---|---|---|
| Leaderboard ranking | Two-pointer **merge sort** | `server/algorithms.js: mergeSortByPoints` |
| Badge tier assignment | Single pointer scan over sorted array | `assignBadges` |
| Date-range issue filter | **Sliding window** (two pointers) | `filterByDateRangeSorted` |
| Duplicate/nearby report detection | Sort by latitude + **two-pointer window** vs. O(n²) brute force | `findDuplicateClusters` |
| Resolved/pending timeline | Two-pointer **merge** of sorted arrays | `mergeTimelines` |
| Matching-upvote pairs | Classic **two-pointer pair sum** on sorted array | `findUpvotePairsSummingTo` |
| All storage (users/issues/messages) | Plain JS arrays, linear-scan lookups | `server/data.js` |

No MongoDB and no `Map`/`Set` in the core logic — just arrays, indices, and pointers walking them.

## Stack

- **Backend:** Node.js + Express, in-memory arrays as the "database"
- **Frontend:** Vanilla HTML/CSS/JS (no framework build step needed)
- **Auth:** Salted password hashing via Node's built-in `crypto` (scrypt)

> Because storage is in-memory, all data resets when the server restarts.
> Swap `server/data.js` for a real DB later without touching `algorithms.js`.

## Run locally

```bash
cd server
npm install
npm start
```

Then open **http://localhost:5000** — the Express server also serves the frontend from `public/`.

## Project structure

```
EcoRadar/
├── server/
│   ├── index.js        # Express routes / API
│   ├── data.js         # in-memory arrays (users, issues, messages)
│   ├── algorithms.js   # two-pointer algorithms (the core of the app)
│   └── package.json
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── README.md
```

## API

| Method | Route | Notes |
|---|---|---|
| POST | `/api/auth/register` | create user |
| POST | `/api/auth/login` | login |
| POST | `/api/issues` | report an issue (+10 points) |
| GET | `/api/issues?start=&end=` | feed, optional two-pointer date filter |
| POST | `/api/issues/:id/upvote` | upvote |
| POST | `/api/issues/:id/resolve` | mark resolved |
| GET | `/api/issues/duplicates?radiusKm=` | two-pointer geo clustering |
| GET | `/api/issues/timeline` | merged resolved+pending timeline |
| GET | `/api/issues/matching-upvotes?target=` | two-pointer pair sum |
| GET | `/api/leaderboard` | merge-sorted, badge-tiered |
| GET | `/api/impact` | aggregate eco-impact stats |
| POST/GET | `/api/issues/:id/messages` | per-issue messaging |

Built for hackathon submission — 2026.
