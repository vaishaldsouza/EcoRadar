# EcoRadar 🌍

A premium, full-stack environmental reporting platform where the **entire data layer and core application logic run on plain in-memory JavaScript arrays and pointer algorithms**. 

EcoRadar completely avoids databases, ORMs, and built-in helper structures like `Map` or `Set` in its core operations. Every non-trivial backend operation is powered by classic computer science pointer, sorting, and partition algorithms, demonstrating how index-based operations can solve real-world problems.

---

## 🚀 The Core Philosophy: "Arrays & Pointers Only"

Instead of delegating data operations to SQL queries or modern key-value collections, EcoRadar implements custom algorithms to manage queries, leaderboard sorting, duplicate geo-clustering, spam control, and triage.

Here is the algorithms directory mapping backend features to core concepts:

| # | Feature | Algorithm / Pattern | Function & File | Time Complexity | Space Complexity |
|---|---|---|---|---|---|
| **1** | Leaderboard Ranking | **Two-Pointer Merge Sort** | `mergeSortByPoints` in `server/algorithms.js` | $O(N \log N)$ | $O(N)$ |
| **2** | Badge Tier Assignment | **Single-Pass Tier Scan** | `assignBadges` in `server/algorithms.js` | $O(N)$ | $O(N)$ |
| **3** | Date-Range Feed Filtering | **Two-Pointer Sliding Window** | `filterByDateRangeSorted` in `server/algorithms.js` | $O(\log N + K)$ | $O(K)$ |
| **4** | Nearby Duplicate Detection | **Sorted Lat + Two-Pointer Sliding Window** | `findDuplicateClusters` in `server/algorithms.js` | $O(N \log N)$ | $O(N)$ |
| **5** | Resolved & Pending Timeline | **Two-Pointer Merge** | `mergeTimelines` in `server/algorithms.js` | $O(N + M)$ | $O(N + M)$ |
| **6** | Matching-Upvote Pair Finder | **Two-Pointer Pair Sum (Two-Sum)** | `findUpvotePairsSummingTo` in `server/algorithms.js` | $O(N \log N)$ | $O(N)$ |
| **7** | Anti-Spam Throttling | **Index-Bounded Backward Window (Contains Duplicate II)** | `isSpamReport` in `server/algorithms.js` | $O(\min(N, W))$ | $O(1)$ |
| **8** | Dominant Issue per Zone | **Boyer-Moore Majority Vote** | `findMajorityCategory` in `server/algorithms.js` | $O(N)$ | $O(1)$ |
| **9** | Severity Triage Partition | **Dutch National Flag (3-Pointer Partition)** | `triagePartition` in `server/algorithms.js` | $O(N)$ | $O(N)$ |

---

## 🔍 Detailed Algorithm Breakdown

### 1. Leaderboard Ranking (`mergeSortByPoints`)
Ranks the users descending by their accumulated points. It recursively splits the user database and merges the segments using two indices (`i` and `j`) to sort in descending order.

### 2. Badge Tier Assignment (`assignBadges`)
Takes the descending-sorted list of users and scans it with a pointer. A fast-forward index (`hi`) scans until the point boundary is crossed, grouping users into **Seedling**, **Sprout**, **Sapling**, or **Guardian** badges in a single continuous linear sweep.

### 3. Date-Range Filtering (`filterByDateRangeSorted`)
When users request reports between start and end dates, the server avoids searching everything. Assuming the data is sorted by timestamp, a sliding window of two pointers bounds the range: a left pointer (`lo`) finds the start, and a right pointer (`hi`) finds the end.

### 4. Nearby Duplicate Detection (`findDuplicateClusters`)
Identifies if duplicate reports have been submitted nearby. The issues are sorted by latitude, and a sliding two-pointer window scans forward only comparing coordinates using the Haversine formula within a delta latitude bounds, reducing the search space from $O(N^2)$ to $O(N \log N)$.

### 5. Timeline Merge (`mergeTimelines`)
Creates a combined activity stream of resolved and pending reports. Instead of concatenating and sorting ($O(N \log N)$), it merges two pre-sorted arrays of resolved and pending issues in $O(N + M)$ time using two pointers.

### 6. Matching-Upvote Pairs (`findUpvotePairsSummingTo`)
Finds pairs of reports whose combined upvotes sum exactly to a target number. It sorts the array and places pointers at both ends (`lo` and `hi`), narrowing inward depending on whether the current sum is less than or greater than the target.

### 7. Anti-Spam Throttling (`isSpamReport`)
Implements a spatial-temporal sliding window checking for immediate spam. If a user submits a report of the same category within $10$ minutes and $100$ meters of their previous reports, it is flagged as spam and rewards no points.

### 8. Dominant Issue per Zone (`findMajorityCategory`)
Finds the dominant issue type (e.g. "Trash", "Pothole") in a local zone. It operates in $O(N)$ time and $O(1)$ space using **Boyer-Moore Voting**, followed by a second verification pass to confirm a strict $>50\%$ majority.

### 9. Severity Triage Partition (`triagePartition`)
Triages issues by severity (Critical/High $\rightarrow$ Moderate $\rightarrow$ Low) in a single pass. It runs a $3$-pointer **Dutch National Flag partition** (`lo`, `mid`, `hi`) to group the array in-place on a copied view.

---

## 🛠️ Technology Stack

- **Frontend:** Vanilla HTML5, CSS3 (with dynamic SVG eco-backgrounds, glassmorphism, responsive flex layouts, and dark mode overrides), and vanilla JS.
- **Backend:** Node.js + Express (serving API endpoints and static assets).
- **Authentication:** In-memory registration and login with password salting and hashing (`crypto.scrypt`).
- **State/Database:** Plain memory storage in JS arrays (`server/data.js`).

---

## 📂 Project Structure

```
EcoRadar/
├── server/
│   ├── index.js        # Express application routes and API controller endpoints
│   ├── data.js         # In-memory arrays (storage lists for users, issues, messages)
│   ├── algorithms.js   # Two-pointer, windowing, sorting, and voting algorithms
│   └── package.json    # Backend project manifest and dependencies
├── public/
│   ├── index.html      # Glassmorphic user interface & dynamic Eco SVG backdrop
│   ├── style.css       # Layout styles, glassmorphic controls, and dark-mode variables
│   └── app.js          # Client-side API broker and dynamic view manager
├── LICENSE             # MIT License
└── README.md           # Project documentation and algorithm handbook
```

---

## 🔌 API Endpoints

### Auth
* **POST** `/api/auth/register` - Create a user profile.
* **POST** `/api/auth/login` - Authenticate and create a session.

### Issues & Feed
* **POST** `/api/issues` - Report a new environmental issue (runs anti-spam check).
* **GET** `/api/issues?start=&end=` - Retrieve issue feed (supports two-pointer date window).
* **POST** `/api/issues/:id/upvote` - Increment issue upvote count.
* **POST** `/api/issues/:id/resolve` - Mark an issue as resolved.

### Advanced Algorithms & Analysis
* **GET** `/api/issues/duplicates?radiusKm=` - Group nearby reports (latitude-sorted window search).
* **GET** `/api/issues/timeline` - Get pre-merged sorted timeline of resolved and pending issues.
* **GET** `/api/issues/matching-upvotes?target=` - Two-pointer pair sum matching.
* **GET** `/api/issues/triage` - Dutch National Flag severity triaging.
* **GET** `/api/impact/majority-category?lat=&lng=&radiusKm=` - Boyer-Moore majority category query.
* **GET** `/api/leaderboard` - Sorted descending list of top contributors with badges.
* **GET** `/api/impact` - Aggregate eco-impact numbers.

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Installation & Run
1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. Open your browser and navigate to **[http://localhost:5000](http://localhost:5000)**.

> 💡 *Note: Since the database is fully in-memory, all data resets when the server restarts.*

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](file:///D:/Ecoo/EcoRadar/LICENSE) file for details.
