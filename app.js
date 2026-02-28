// Top Daily Tips (static) + Supabase Auth + RLS-friendly tracker
// IMPORTANT: Paste your own values below (keep the quotes)
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "PASTE_YOUR_ANON_PUBLIC_KEY_HERE";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------------
// Elements
// ----------------------
const el = (id) => document.getElementById(id);

const betsContainer = el("betsContainer") || el("betsGrid");
const betsStatus = el("betsStatus");
const tabBtns = Array.from(document.querySelectorAll(".tab-btn"));
const sortSelect = el("sortSelect") || el("betsSort");

const authBtn = el("authBtn");
const authModal = el("authModal");
const authBackdrop = el("authBackdrop");
const authClose = el("authClose");
const authTitle = el("authTitle");
const authHint = el("authHint");
const authEmail = el("authEmail");
const authPass = el("authPass");
const authSubmit = el("authSubmit");
const authToggle = el("authToggle");
const authMsg = el("authMsg");

const totalProfitEl = el("totalProfit") || el("profit");
const totalStakeEl = el("totalStake") || el("totalStakedCard");
const totalBetsEl = el("totalBets");
const betCountEl = el("betCount");
const trackerWrapper = el("trackerWrapper");
const trackerArrow = el("trackerArrow");
const trackerTable = el("trackerTable");

const monthlyWrapper = el("monthlyWrapper");
const monthlyArrow = el("monthlyArrow");
const monthlyTable = el("monthlyTable");

// ----------------------
// State
// ----------------------
let authMode = "signin"; // signin | signup
let currentUser = null;
let currentTab = "value"; // value | tracker
let currentSort = "date_desc";

// ----------------------
// Modal helpers
// ----------------------
function openAuthModal() {
  authMsg.textContent = "";
  authEmail.value = authEmail.value || "";
  authPass.value = "";
  authModal.style.display = "block";
  authModal.setAttribute("aria-hidden", "false");
}

function closeAuthModal() {
  authModal.style.display = "none";
  authModal.setAttribute("aria-hidden", "true");
  authMsg.textContent = "";
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignIn = mode === "signin";
  authTitle.textContent = isSignIn ? "Log in" : "Create account";
  authSubmit.textContent = isSignIn ? "Log in" : "Sign up";
  authToggle.textContent = isSignIn ? "Create account" : "I already have an account";
  authHint.textContent = isSignIn
    ? "Use email + password."
    : "Create an account with email + password.";
  authMsg.textContent = "";
}

// ----------------------
// Auth
// ----------------------
async function refreshSession() {
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;
  updateAuthUI();
}

function updateAuthUI() {
  if (!authBtn) return;
  authBtn.textContent = currentUser ? "Log out" : "Log in";
}

async function handleAuthButton() {
  if (!currentUser) {
    setAuthMode("signin");
    openAuthModal();
    return;
  }
  await supabase.auth.signOut();
  await refreshSession();
  // Clear tracker UI
  trackerTable.innerHTML = "";
  setStats({ totalProfit: 0, totalStake: 0, totalBets: 0 });
}

async function submitAuth() {
  const email = authEmail.value.trim();
  const password = authPass.value;
  authMsg.textContent = "";

  if (!email || !password) {
    authMsg.textContent = "Please enter email + password.";
    return;
  }

  try {
    if (authMode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeAuthModal();
      await refreshSession();
      if (currentTab === "tracker") await loadTracker();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      authMsg.textContent = "Signed up. If email confirmation is ON, check your inbox.";
      // user may not be logged in until confirmed
      await refreshSession();
    }
  } catch (e) {
    authMsg.textContent = e?.message || "Auth error";
  }
}

// ----------------------
// Tabs
// ----------------------
function setTab(tab) {
  currentTab = tab;
  tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));

  if (tab === "value") {
    document.getElementById("valueSection").style.display = "block";
    document.getElementById("trackerSection").style.display = "none";
    loadBets();
  } else {
    document.getElementById("valueSection").style.display = "none";
    document.getElementById("trackerSection").style.display = "block";
    loadTracker();
  }
}

// ----------------------
// Value bets
// ----------------------
function renderBetCard(bet) {
  const date = bet.bet_date ? new Date(bet.bet_date).toISOString().slice(0, 10) : "";
  const valuePct = bet.value_pct != null ? `${Number(bet.value_pct).toFixed(1)}%` : "";

  return `
    <div class="bet-card">
      <div class="bet-left">
        <div class="bet-match">${escapeHtml(bet.match || "")}</div>
        <div class="bet-market">${escapeHtml(bet.market || "")}</div>
        <div class="bet-meta">
          <span class="pill">Value ${valuePct}</span>
          <span class="pill">Odds ${escapeHtml(String(bet.odds ?? ""))}</span>
        </div>
      </div>
      <div class="bet-right">
        <div class="bet-date">${escapeHtml(date)}</div>
        <button class="btn-add" data-id="${bet.id}">Add</button>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getOrderBy() {
  switch (currentSort) {
    case "date_asc":
      return { column: "bet_date", ascending: true };
    case "value_desc":
      return { column: "value_pct", ascending: false };
    case "value_asc":
      return { column: "value_pct", ascending: true };
    case "date_desc":
    default:
      return { column: "bet_date", ascending: false };
  }
}

async function loadBets() {
  if (!betsContainer) return;
  if (betsStatus) betsStatus.textContent = "Loading bets...";
  betsContainer.innerHTML = "";

  const { column, ascending } = getOrderBy();
  const { data, error } = await supabase
    .from("value_bets")
    .select("id, match, market, odds, bet_date, value_pct")
    .order(column, { ascending, nullsFirst: false });

  if (error) {
    if (betsStatus) betsStatus.textContent = "Error loading bets: " + error.message;
    betsContainer.innerHTML = "";
    return;
  }

  if (!data || data.length === 0) {
    if (betsStatus) betsStatus.textContent = "No bets found.";
    betsContainer.innerHTML = "";
    return;
  }

  if (betsStatus) betsStatus.textContent = "";
  betsContainer.innerHTML = data.map(renderBetCard).join("");

  // Add handlers
  betsContainer.querySelectorAll(".btn-add").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const betId = btn.getAttribute("data-id");
      await addToTracker(betId);
    });
  });
}

async function addToTracker(betId) {
  if (!currentUser) {
    setAuthMode("signin");
    openAuthModal();
    authMsg.textContent = "Please log in to add bets to your tracker.";
    return;
  }

  // Fetch bet
  const { data: bet, error: betErr } = await supabase
    .from("value_bets")
    .select("id, match, market, odds, bet_date")
    .eq("id", betId)
    .single();

  if (betErr) {
    alert(betErr.message);
    return;
  }

  // Insert into bet_tracker (must have these columns)
  const payload = {
    user_id: currentUser.id,
    bet_id: bet.id,
    match: bet.match,
    market: bet.market,
    odds: bet.odds,
    bet_date: bet.bet_date,
    stake: null,
    result: null,
    profit: null,
  };

  const { error } = await supabase.from("bet_tracker").insert(payload);

  if (error) {
    alert(`Could not add: ${error.message}`);
    return;
  }

  // Switch to tracker tab
  setTab("tracker");
}

// ----------------------
// Tracker
// ----------------------
function setStats({ totalProfit, totalStake, totalBets }) {
  if (totalProfitEl) totalProfitEl.textContent = formatMoney(totalProfit);
  if (totalStakeEl) totalStakeEl.textContent = formatMoney(totalStake);
  if (totalBetsEl) totalBetsEl.textContent = String(totalBets);
  if (betCountEl) betCountEl.textContent = String(totalBets);
}

function formatMoney(v) {
  const n = Number(v || 0);
  return n.toFixed(2);
}

function renderTrackerTable(rows) {
  if (!trackerTable) return;

  const head = `
    <table class="tracker-table">
      <thead>
        <tr>
          <th>Match</th>
          <th>Market</th>
          <th>Odds</th>
          <th>Stake</th>
          <th>Result</th>
          <th>Profit</th>
        </tr>
      </thead>
      <tbody>
  `;

  const body = rows
    .map((r) => {
      return `
        <tr data-id="${r.id}">
          <td>${escapeHtml(r.match || "")}</td>
          <td>${escapeHtml(r.market || "")}</td>
          <td>${escapeHtml(String(r.odds ?? ""))}</td>
          <td><input class="trk-stake" type="number" step="0.01" min="0" value="${r.stake ?? ""}" placeholder="0"></td>
          <td>
            <select class="trk-result">
              <option value="" ${r.result == null ? "selected" : ""}>Pending</option>
              <option value="win" ${r.result === "win" ? "selected" : ""}>Win</option>
              <option value="loss" ${r.result === "loss" ? "selected" : ""}>Loss</option>
              <option value="void" ${r.result === "void" ? "selected" : ""}>Void</option>
            </select>
          </td>
          <td>${escapeHtml(formatMoney(r.profit))}</td>
        </tr>
      `;
    })
    .join("");

  const foot = `</tbody></table>`;

  trackerTable.innerHTML = head + body + foot;

  // Wire inputs
  trackerTable.querySelectorAll("tr[data-id]").forEach((tr) => {
    const id = tr.getAttribute("data-id");
    const stakeInput = tr.querySelector(".trk-stake");
    const resultSelect = tr.querySelector(".trk-result");

    const save = async () => {
      const stake = stakeInput.value === "" ? null : Number(stakeInput.value);
      const result = resultSelect.value === "" ? null : resultSelect.value;

      // Profit calc (simple): win => stake*(odds-1), loss => -stake, void => 0
      let profit = null;
      if (stake != null && result) {
        if (result === "win") profit = stake * (Number(tr.querySelectorAll('td')[2].textContent) - 1);
        if (result === "loss") profit = -stake;
        if (result === "void") profit = 0;
      }

      const { error } = await supabase
        .from("bet_tracker")
        .update({ stake, result, profit })
        .eq("id", id);

      if (error) {
        alert(error.message);
        return;
      }

      await loadTracker();
    };

    stakeInput.addEventListener("change", save);
    resultSelect.addEventListener("change", save);
  });
}

async function loadTracker() {
  if (!currentUser) {
    trackerTable.innerHTML = `<div class="empty">Log in to use the tracker.</div>`;
    setStats({ totalProfit: 0, totalStake: 0, totalBets: 0 });
    return;
  }

  trackerTable.innerHTML = `<div class="loading">Loading tracker...</div>`;

  const { data, error } = await supabase
    .from("bet_tracker")
    .select("id, match, market, odds, stake, result, profit")
    .order("created_at", { ascending: false });

  if (error) {
    trackerTable.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    setStats({ totalProfit: 0, totalStake: 0, totalBets: 0 });
    return;
  }

  const rows = data || [];
  const totalStake = rows.reduce((a, r) => a + (Number(r.stake) || 0), 0);
  const totalProfit = rows.reduce((a, r) => a + (Number(r.profit) || 0), 0);

  setStats({ totalProfit, totalStake, totalBets: rows.length });
  renderTrackerTable(rows);
}

// ----------------------
// Collapsible UI
// ----------------------
window.toggleTracker = function toggleTracker() {
  const isCollapsed = trackerWrapper.classList.contains("collapsed");
  trackerWrapper.classList.toggle("collapsed", !isCollapsed);
  trackerArrow.textContent = isCollapsed ? "▲" : "▼";
};

window.toggleMonthly = function toggleMonthly() {
  const isCollapsed = monthlyWrapper.classList.contains("collapsed");
  monthlyWrapper.classList.toggle("collapsed", !isCollapsed);
  monthlyArrow.textContent = isCollapsed ? "▲" : "▼";
  if (monthlyTable) monthlyTable.innerHTML = ""; // optional
};

// Chart tabs (just switching panes; charts optional)
const chartTabBtns = Array.from(document.querySelectorAll(".chart-tabs .tab-btn"));
const chartPanes = Array.from(document.querySelectorAll(".chart-pane"));
chartTabBtns.forEach((b) => {
  b.addEventListener("click", () => {
    chartTabBtns.forEach((x) => x.classList.toggle("active", x === b));
    const t = b.dataset.tab;
    chartPanes.forEach((p) => p.classList.toggle("active", p.id === `pane-${t}`));
  });
});

// ----------------------
// Boot
// ----------------------
if (authBtn) authBtn.addEventListener("click", handleAuthButton);
if (authClose) authClose.addEventListener("click", closeAuthModal);
if (authBackdrop) authBackdrop.addEventListener("click", closeAuthModal);
if (authSubmit) authSubmit.addEventListener("click", submitAuth);
if (authToggle)
  authToggle.addEventListener("click", () => setAuthMode(authMode === "signin" ? "signup" : "signin"));

// Main tabs
const mainTabBtns = Array.from(document.querySelectorAll('.main-tabs .tab-btn'));
mainTabBtns.forEach((b) => {
  b.addEventListener('click', () => setTab(b.dataset.tab));
});

if (sortSelect) {
  sortSelect.addEventListener("change", () => {
    currentSort = sortSelect.value;
    loadBets();
  });
}

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  updateAuthUI();
  if (currentTab === "tracker") loadTracker();
});

refreshSession().then(() => {
  setTab("value");
});
