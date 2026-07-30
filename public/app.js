const API = "/api";
let currentUser = JSON.parse(localStorage.getItem("ecoradar_user") || "null");
let authMode = "login";

// ---------------- theme toggle ----------------
const themeToggle = document.getElementById("themeToggle");
function loadTheme() {
  const savedTheme = localStorage.getItem("ecoradar_theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "☀️";
  } else {
    document.body.classList.remove("dark");
    themeToggle.textContent = "🌙";
  }
}
themeToggle.onclick = () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  themeToggle.textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("ecoradar_theme", isDark ? "dark" : "light");
};
loadTheme();

// ---------------- tabs ----------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "leaderboard") loadLeaderboard();
    if (btn.dataset.tab === "impact") loadImpact();
    if (btn.dataset.tab === "duplicates") loadDuplicates();
    if (btn.dataset.tab === "feed") loadFeed();
  });
});

// ---------------- auth UI ----------------
const authModal = document.getElementById("authModal");
function refreshAuthUI() {
  const label = document.getElementById("userLabel");
  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  if (currentUser) {
    label.textContent = `👤 ${currentUser.name} (${currentUser.points} pts)`;
    loginBtn.classList.add("hidden");
    signupBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  } else {
    label.textContent = "";
    loginBtn.classList.remove("hidden");
    signupBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
  }
}
document.getElementById("loginBtn").onclick = () => openAuth("login");
document.getElementById("signupBtn").onclick = () => openAuth("signup");
document.getElementById("authCancel").onclick = () => authModal.classList.add("hidden");
document.getElementById("logoutBtn").onclick = () => {
  currentUser = null;
  localStorage.removeItem("ecoradar_user");
  refreshAuthUI();
};

function openAuth(mode) {
  authMode = mode;
  document.getElementById("authModalTitle").textContent = mode === "login" ? "Login" : "Sign Up";
  document.getElementById("authName").classList.toggle("hidden", mode === "login");
  document.getElementById("authMsg").textContent = "";
  authModal.classList.remove("hidden");
}

document.getElementById("authSubmit").onclick = async () => {
  const name = document.getElementById("authName").value;
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;
  const url = authMode === "login" ? "/auth/login" : "/auth/register";
  const body = authMode === "login" ? { email, password } : { name, email, password };

  const res = await fetch(API + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById("authMsg").textContent = data.error || "Error";
    return;
  }
  currentUser = data;
  localStorage.setItem("ecoradar_user", JSON.stringify(data));
  refreshAuthUI();
  authModal.classList.add("hidden");
};

// ---------------- issue feed ----------------
async function loadFeed(start, end) {
  let url = `${API}/issues`;
  if (start && end) url += `?start=${start}&end=${end}`;
  const res = await fetch(url);
  const issues = await res.json();
  const list = document.getElementById("issueList");
  list.innerHTML = issues
    .map(
      (i) => `
    <div class="card severity-${i.severity}">
      <span class="badge-tag">${i.severity}</span>
      <h4>${escapeHtml(i.title)}</h4>
      <p>${i.category.replace(/_/g, " ")}</p>
      <p>📍 ${i.lat.toFixed(4)}, ${i.lng.toFixed(4)}</p>
      <p>⬆️ ${i.upvotes} upvotes • ${i.status}</p>
      <button onclick="upvote(${i.id})">Upvote</button>
    </div>`
    )
    .join("") || "<p>No issues reported yet.</p>";
}

window.upvote = async (id) => {
  await fetch(`${API}/issues/${id}/upvote`, { method: "POST" });
  loadFeed();
};

document.getElementById("applyFilter").onclick = () => {
  const start = document.getElementById("filterStart").value;
  const end = document.getElementById("filterEnd").value;
  if (!start || !end) return;
  loadFeed(new Date(start).getTime(), new Date(end).getTime() + 86400000 - 1);
};
document.getElementById("clearFilter").onclick = () => {
  document.getElementById("filterStart").value = "";
  document.getElementById("filterEnd").value = "";
  loadFeed();
};

// ---------------- report form ----------------
document.getElementById("reportForm").onsubmit = async (e) => {
  e.preventDefault();
  const msg = document.getElementById("reportMsg");
  if (!currentUser) {
    msg.textContent = "Please log in first.";
    return;
  }
  const body = {
    userId: currentUser.id,
    title: document.getElementById("title").value,
    category: document.getElementById("category").value,
    severity: document.getElementById("severity").value,
    lat: document.getElementById("lat").value,
    lng: document.getElementById("lng").value,
  };
  const res = await fetch(`${API}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    currentUser.points += 10;
    localStorage.setItem("ecoradar_user", JSON.stringify(currentUser));
    refreshAuthUI();
    msg.textContent = "✅ Issue reported! +10 points";
    e.target.reset();
    loadFeed();
  } else {
    msg.textContent = "Error submitting report.";
  }
};

// ---------------- leaderboard ----------------
async function loadLeaderboard() {
  const res = await fetch(`${API}/leaderboard`);
  const rows = await res.json();
  document.querySelector("#leaderboardTable tbody").innerHTML = rows
    .map((r) => `<tr><td>#${r.rank}</td><td>${escapeHtml(r.name)}</td><td>${r.points}</td><td>${r.badge} ${r.badgeName}</td></tr>`)
    .join("");
}

// ---------------- impact dashboard ----------------
async function loadImpact() {
  const res = await fetch(`${API}/impact`);
  const d = await res.json();
  document.getElementById("impactCards").innerHTML = `
    <div class="card"><h4>🌳 Trees Saved</h4><p>${d.treesSaved}</p></div>
    <div class="card"><h4>🗑️ Waste Removed</h4><p>${d.wasteKgRemoved} kg</p></div>
    <div class="card"><h4>💨 CO₂ Prevented</h4><p>${d.co2eqPreventedKg} kg</p></div>
    <div class="card"><h4>📋 Total Issues</h4><p>${d.totalIssues}</p></div>
    <div class="card"><h4>✅ Resolved</h4><p>${d.resolvedCount}</p></div>
    <div class="card"><h4>⏳ Pending</h4><p>${d.pendingCount}</p></div>
  `;
}

// ---------------- duplicates ----------------
async function loadDuplicates() {
  const res = await fetch(`${API}/issues/duplicates`);
  const clusters = await res.json();
  const list = document.getElementById("dupList");
  list.innerHTML =
    clusters
      .map(
        (cluster, idx) => `
    <div class="card">
      <h4>Cluster #${idx + 1} (${cluster.length} reports)</h4>
      <ul>${cluster.map((i) => `<li>${escapeHtml(i.title)} — ${i.lat.toFixed(4)},${i.lng.toFixed(4)}</li>`).join("")}</ul>
    </div>`
      )
      .join("") || "<p>No nearby duplicate clusters detected.</p>";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

refreshAuthUI();
loadFeed();
