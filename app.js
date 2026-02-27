/* Top Daily Tips - Value Bets dashboard + per-user tracker (Supabase) */

// --- Supabase ---
const SUPABASE_URL = "https://krmmmutcejnzdfupexp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtybW1tdXRjZWpuemRmdXBleHAiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc0MDY3NDY4MSwiZXhwIjoyMDU2MjUwNjgxfQ.qwQiDD0u-cc1VcywYKB44Ye6Zm6xthSZmH9eDq8o2Vg";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- State ---
let currentUser = null;
let valueBets = []; // raw from DB
let filteredBets = []; // after filters
let sortKey = "rank";
let sortDir = "asc";
let wide = false;

// --- Helpers ---
const $ = (id) => document.getElementById(id);

function toNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asDateStr(v){
  if(!v) return "";
  // supports ISO string or date string
  const d = new Date(v);
  if(Number.isNaN(d.getTime())) return String(v);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function asPrettyDateTime(v){
  if(!v) return "";
  const d = new Date(v);
  if(Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function safeText(v){
  return (v === null || v === undefined) ? "" : String(v);
}

function normalizeRow(row){
  // Map common column names from Supabase to the UI keys.
  // This makes it work even if your DB columns differ slightly.
  const match = row.match ?? row.fixture ?? row.game ?? row.event ?? "";
  const league = row.league ?? row.competition ?? "";
  const market = row.market ?? row.bet_type ?? row.pick ?? "";
  const odds = row.odds ?? row.bookmaker_odds ?? row.price ?? null;
  const probability = row.probability ?? row.prob ?? row.p ?? row.p_over25 ?? null;
  const betDate = row.bet_date ?? row.date ?? row.date_utc ?? row.dateUTC ?? row.kickoff ?? row.kickoff_utc ?? row.time ?? null;
  return {
    ...row,
    __match: match,
    __league: league,
    __market: market,
    __odds: odds,
    __prob: probability,
    __date: betDate,
  };
}

function compare(a,b,dir){
  if(a === b) return 0;
  if(a === null || a === undefined) return dir === 'asc' ? 1 : -1;
  if(b === null || b === undefined) return dir === 'asc' ? -1 : 1;
  if(typeof a === 'number' && typeof b === 'number') return dir === 'asc' ? a-b : b-a;
  return dir === 'asc' ? String(a).localeCompare(String(b)) : String(b).localeCompare(String(a));
}

function setAuthUI(){
  const status = $("authStatus");
  const btnLogout = $("btnLogout");
  const btnLogin = $("btnLogin");
  const btnSignup = $("btnSignup");
  const email = $("email");
  const pass = $("password");

  if(currentUser){
    status.textContent = `Logged in: ${currentUser.email}`;
    btnLogout.style.display = "inline-block";
    btnLogin.style.display = "none";
    btnSignup.style.display = "none";
    email.style.display = "none";
    pass.style.display = "none";
  }else{
    status.textContent = "Not logged in";
    btnLogout.style.display = "none";
    btnLogin.style.display = "inline-block";
    btnSignup.style.display = "inline-block";
    email.style.display = "inline-block";
    pass.style.display = "inline-block";
  }
}

function showToast(msg){
  alert(msg);
}

// --- Tabs ---
function showTab(which){
  const bets = $("betsSection");
  const tr = $("trackerSection");
  const tabB = $("tabBets");
  const tabT = $("tabTracker");
  if(which === 'bets'){
    bets.style.display = "block";
    tr.style.display = "none";
    tabB.classList.add('active');
    tabT.classList.remove('active');
  }else{
    bets.style.display = "none";
    tr.style.display = "block";
    tabT.classList.add('active');
    tabB.classList.remove('active');
    loadTracker();
  }
}

// --- Value Bets load/render ---
async function loadValueBets(){
  const { data, error } = await client
    .from('value_bets')
    .select('*');

  if(error){
    console.error(error);
    showToast(`Value bets error: ${error.message}`);
    return;
  }

  valueBets = (data || []).map(normalizeRow);

  // Add rank (by best probability/odds/value if you have it)
  // Default: sort by probability desc if available, else by date asc.
  const hasProb = valueBets.some(r => toNum(r.__prob) !== null);
  const sortedForRank = [...valueBets].sort((a,b)=>{
    if(hasProb){
      return (toNum(b.__prob) ?? -1) - (toNum(a.__prob) ?? -1);
    }
    return new Date(a.__date || 0) - new Date(b.__date || 0);
  });
  const idToRank = new Map();
  sortedForRank.forEach((r, i)=> idToRank.set(r.id, i+1));
  valueBets = valueBets.map(r => ({...r, __rank: idToRank.get(r.id) ?? null }));

  populateFilterOptions();
  applyFilters();
}

function populateFilterOptions(){
  const leagues = new Set();
  const markets = new Set();
  valueBets.forEach(r=>{
    if(r.__league) leagues.add(r.__league);
    if(r.__market) markets.add(r.__market);
  });

  const leagueSel = $("fLeague");
  const marketSel = $("fMarket");

  leagueSel.innerHTML = '<option value="">All</option>' + [...leagues].sort().map(v=>`<option>${escapeHtml(v)}</option>`).join('');
  marketSel.innerHTML = '<option value="">All</option>' + [...markets].sort().map(v=>`<option>${escapeHtml(v)}</option>`).join('');
}

function escapeHtml(str){
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function applyFilters(){
  const q = ($("fSearch").value || '').trim().toLowerCase();
  const league = $("fLeague").value;
  const market = $("fMarket").value;
  const minProb = toNum($("fMinProb").value);
  const dFrom = $("fDateFrom").value ? new Date($("fDateFrom").value) : null;
  const dTo = $("fDateTo").value ? new Date($("fDateTo").value) : null;

  filteredBets = valueBets.filter(r=>{
    if(league && r.__league !== league) return false;
    if(market && r.__market !== market) return false;
    if(minProb !== null){
      const p = toNum(r.__prob);
      if(p === null || p < minProb) return false;
    }
    if(dFrom){
      const d = new Date(r.__date);
      if(!Number.isNaN(d.getTime()) && d < dFrom) return false;
    }
    if(dTo){
      const d = new Date(r.__date);
      if(!Number.isNaN(d.getTime()) && d > dTo) return false;
    }
    if(q){
      const hay = `${r.__match} ${r.__league} ${r.__market}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });

  sortAndRender();
}

function sortAndRender(){
  const dir = sortDir;
  const key = sortKey;

  const getVal = (r)=>{
    switch(key){
      case 'rank': return r.__rank;
      case 'bet_date': return new Date(r.__date || 0).getTime();
      case 'league': return r.__league;
      case 'match': return r.__match;
      case 'market': return r.__market;
      case 'odds': return toNum(r.__odds);
      case 'probability': return toNum(r.__prob);
      default: return r[key];
    }
  };

  const rows = [...filteredBets].sort((a,b)=> compare(getVal(a), getVal(b), dir));
  renderValueBets(rows);
}

function renderValueBets(rows){
  const tbody = $("betsTbody");
  tbody.innerHTML = "";

  $("rowsMeta").textContent = `${rows.length} of ${valueBets.length} rows`;

  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${safeText(r.__rank ?? '')}</td>
      <td>${escapeHtml(asDateStr(r.__date))}</td>
      <td>${escapeHtml(safeText(r.__league))}</td>
      <td>${escapeHtml(safeText(r.__match))}</td>
      <td>${escapeHtml(safeText(r.__market))}</td>
      <td class="num">${escapeHtml(safeText(r.__odds ?? ''))}</td>
      <td class="num">${formatProbPill(r.__prob)}</td>
      <td><button class="actionBtn" data-id="${r.id}">Add</button></td>
    `;

    tr.addEventListener('click', (e)=>{
      // clicking button should not trigger row select
      if(e.target && e.target.tagName === 'BUTTON') return;
      showRowDetails(r);
    });

    const btn = tr.querySelector('button');
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      addToTracker(r);
    });

    tbody.appendChild(tr);
  });
}

function formatProbPill(p){
  const n = toNum(p);
  if(n === null) return '';
  const shown = n <= 1 ? n.toFixed(3) : n.toFixed(2);
  return `<span class="pill">${shown}</span>`;
}

function showRowDetails(r){
  const box = $("rowDetails");
  box.style.display = "block";
  const entries = Object.entries(r)
    .filter(([k])=>!k.startsWith('__'))
    .slice(0, 24)
    .map(([k,v])=>`<div><b>${escapeHtml(k)}</b>: ${escapeHtml(safeText(v))}</div>`)
    .join('');

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
      <div><b>${escapeHtml(r.__match || 'Details')}</b></div>
      <button class="btn btn-secondary" id="closeDetails">Close</button>
    </div>
    <div style="margin-top:10px;display:grid;gap:6px">${entries}</div>
  `;
  $("closeDetails").onclick = ()=> box.style.display = "none";
}

// --- Tracker ---
async function addToTracker(betRow){
  if(!currentUser){
    showToast('Please log in first.');
    return;
  }

  // Insert into user_results as the per-user tracker
  // tip_id links to value_bets.id
  const payload = {
    user_id: currentUser.id,
    tip_id: betRow.id,
    stake: 10,
    result: 'pending'
  };

  const { error } = await client
    .from('user_results')
    .upsert(payload, { onConflict: 'user_id,tip_id' });

  if(error){
    console.error(error);
    showToast(`Add failed: ${error.message}`);
    return;
  }

  showToast('Added to tracker');
}

async function loadTracker(){
  const tbody = $("trackerTbody");
  tbody.innerHTML = "";

  if(!currentUser){
    tbody.innerHTML = '<tr><td colspan="7" style="color:rgba(255,255,255,.55)">Log in to see your tracker.</td></tr>';
    updateStats([]);
    return;
  }

  const { data: results, error } = await client
    .from('user_results')
    .select('id, tip_id, stake, result, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if(error){
    console.error(error);
    tbody.innerHTML = '<tr><td colspan="7">Error loading tracker.</td></tr>';
    return;
  }

  const tipIds = (results || []).map(r=>r.tip_id);
  if(tipIds.length === 0){
    tbody.innerHTML = '<tr><td colspan="7" style="color:rgba(255,255,255,.55)">No bets yet. Add from Value Bets.</td></tr>';
    updateStats([]);
    return;
  }

  const { data: tips, error: tipsErr } = await client
    .from('value_bets')
    .select('*')
    .in('id', tipIds);

  if(tipsErr){
    console.error(tipsErr);
    tbody.innerHTML = '<tr><td colspan="7">Error loading bet details.</td></tr>';
    return;
  }

  const tipsById = new Map((tips || []).map(t=>[t.id, normalizeRow(t)]));

  const rows = (results || []).map(r=>{
    const tip = tipsById.get(r.tip_id);
    return {
      ...r,
      tip
    };
  }).filter(r => !!r.tip);

  rows.forEach(r=>{
    const tr = document.createElement('tr');
    const odds = r.tip.__odds ?? '';
    tr.innerHTML = `
      <td>${escapeHtml(asDateStr(r.tip.__date))}</td>
      <td>${escapeHtml(safeText(r.tip.__match))}</td>
      <td>${escapeHtml(safeText(r.tip.__market))}</td>
      <td class="num">${escapeHtml(safeText(odds))}</td>
      <td class="num"><input data-id="${r.id}" class="stakeInput" value="${escapeHtml(String(r.stake ?? ''))}" /></td>
      <td>
        <select data-id="${r.id}" class="resultSelect">
          ${['pending','won','lost','void'].map(v=>`<option value="${v}" ${r.result===v?'selected':''}>${v}</option>`).join('')}
        </select>
      </td>
      <td><button class="actionBtn" data-del="${r.id}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });

  // Wire inputs
  tbody.querySelectorAll('.stakeInput').forEach(inp=>{
    inp.addEventListener('change', async ()=>{
      const id = inp.getAttribute('data-id');
      const stake = toNum(inp.value);
      if(stake === null){
        showToast('Stake must be a number');
        return;
      }
      const { error: upErr } = await client.from('user_results').update({stake}).eq('id', id);
      if(upErr) showToast(upErr.message);
      await loadTracker();
    });
  });

  tbody.querySelectorAll('.resultSelect').forEach(sel=>{
    sel.addEventListener('change', async ()=>{
      const id = sel.getAttribute('data-id');
      const result = sel.value;
      const { error: upErr } = await client.from('user_results').update({result}).eq('id', id);
      if(upErr) showToast(upErr.message);
      await loadTracker();
    });
  });

  tbody.querySelectorAll('button[data-del]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-del');
      const { error: delErr } = await client.from('user_results').delete().eq('id', id);
      if(delErr) showToast(delErr.message);
      await loadTracker();
    });
  });

  updateStats(rows);
}

function updateStats(trackerRows){
  const start = toNum($("startingBankroll").value) ?? 0;
  let profit = 0;
  let staked = 0;
  let wins = 0;
  let losses = 0;
  let oddsSum = 0;
  let oddsCount = 0;

  trackerRows.forEach(r=>{
    const stake = toNum(r.stake) ?? 0;
    const odds = toNum(r.tip?.__odds);
    if(odds !== null){ oddsSum += odds; oddsCount += 1; }
    staked += stake;

    if(r.result === 'won'){
      wins += 1;
      if(odds !== null) profit += stake * (odds - 1);
    }else if(r.result === 'lost'){
      losses += 1;
      profit -= stake;
    }else if(r.result === 'void'){
      // no change
    }
  });

  const bankroll = start + profit;
  const total = trackerRows.length;
  const decided = wins + losses;
  const winrate = decided > 0 ? (wins/decided)*100 : 0;
  const roi = staked > 0 ? (profit / staked) * 100 : 0;
  const avgOdds = oddsCount > 0 ? (oddsSum/oddsCount) : 0;

  $("bankroll").textContent = `£${bankroll.toFixed(2)}`;
  $("profit").textContent = `£${profit.toFixed(2)}`;
  $("roi").textContent = `${roi.toFixed(0)}%`;
  $("winrate").textContent = `${winrate.toFixed(0)}%`;
  $("wins").textContent = String(wins);
  $("losses").textContent = String(losses);
  $("avgOdds").textContent = avgOdds ? avgOdds.toFixed(2) : '0';
  $("totalBets").textContent = String(total);
}

function exportTrackerCSV(){
  const rows = [];
  const tbody = $("trackerTbody");
  tbody.querySelectorAll('tr').forEach(tr=>{
    const tds = tr.querySelectorAll('td');
    if(tds.length < 6) return;
    rows.push([
      tds[0].innerText,
      tds[1].innerText,
      tds[2].innerText,
      tds[3].innerText,
      tr.querySelector('.stakeInput')?.value ?? '',
      tr.querySelector('.resultSelect')?.value ?? '',
    ]);
  });

  const header = ['date','match','market','odds','stake','result'];
  const csv = [header, ...rows]
    .map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tracker.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// --- Auth ---
async function signup(){
  const email = $("email").value.trim();
  const password = $("password").value;
  if(!email || !password) return showToast('Enter email + password');
  const { error } = await client.auth.signUp({ email, password });
  if(error) showToast(error.message);
  else showToast('Sign up successful. Check your email to confirm if required.');
}

async function login(){
  const email = $("email").value.trim();
  const password = $("password").value;
  if(!email || !password) return showToast('Enter email + password');
  const { error } = await client.auth.signInWithPassword({ email, password });
  if(error) showToast(error.message);
}

async function logout(){
  const { error } = await client.auth.signOut();
  if(error) showToast(error.message);
}

async function initAuth(){
  const { data } = await client.auth.getSession();
  currentUser = data.session?.user ?? null;
  setAuthUI();

  client.auth.onAuthStateChange((_event, session)=>{
    currentUser = session?.user ?? null;
    setAuthUI();
    // refresh tracker when auth changes
    if($("trackerSection").style.display !== 'none') loadTracker();
  });
}

// --- Wire UI ---
function wireUI(){
  $("tabBets").onclick = ()=>showTab('bets');
  $("tabTracker").onclick = ()=>showTab('tracker');

  $("btnSignup").onclick = signup;
  $("btnLogin").onclick = login;
  $("btnLogout").onclick = logout;

  ["fSearch","fLeague","fMarket","fMinProb","fDateFrom","fDateTo"].forEach(id=>{
    $(id).addEventListener('input', applyFilters);
    $(id).addEventListener('change', applyFilters);
  });

  $("resetFilters").onclick = ()=>{
    $("fSearch").value = '';
    $("fLeague").value = '';
    $("fMarket").value = '';
    $("fMinProb").value = '';
    $("fDateFrom").value = '';
    $("fDateTo").value = '';
    applyFilters();
  };

  $("toggleWide").onclick = ()=>{
    wide = !wide;
    document.body.classList.toggle('wide', wide);
  };

  // Sort headers
  document.querySelectorAll('#betsTable thead th[data-key]').forEach(th=>{
    th.addEventListener('click', ()=>{
      const k = th.getAttribute('data-key');
      if(sortKey === k){
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      }else{
        sortKey = k;
        sortDir = (k === 'rank') ? 'asc' : 'asc';
      }
      sortAndRender();
    });
  });

  $("startingBankroll").addEventListener('change', ()=> loadTracker());
  $("exportCSV").onclick = exportTrackerCSV;
}

// --- Boot ---
(async function main(){
  wireUI();
  await initAuth();
  await loadValueBets();
})();
