
const SUPABASE_URL="https://krmmmutcejnzdfupexpv.supabase.co";
const SUPABASE_KEY="sb_publishable_3NHjMMVw1lai9UNAA-0QZA_sKM21LgD";
const client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

let currentUser = null;
let userResultsByTipId = {}; // tip_id -> {id, tip_id, stake, result}

// --- Auth helpers ---
async function initAuth(){
  // Wire buttons (if present)
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if(loginBtn) loginBtn.addEventListener('click', login);
  if(signupBtn) signupBtn.addEventListener('click', signup);
  if(logoutBtn) logoutBtn.addEventListener('click', logout);

  // Initial session
  const { data: { session } } = await client.auth.getSession();
  currentUser = session?.user ?? null;
  renderAuthStatus();

  // React to auth changes
  client.auth.onAuthStateChange((_event, session2) => {
    currentUser = session2?.user ?? null;
    userResultsByTipId = {};
    renderAuthStatus();
    // Reload tracker UI with per-user results
    loadTracker();
  });
}

function renderAuthStatus(){
  const statusEl = document.getElementById('authStatus');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const emailEl = document.getElementById('authEmail');
  const passEl = document.getElementById('authPassword');

  if(!statusEl) return;

  if(currentUser){
    statusEl.textContent = `Logged in: ${currentUser.email ?? currentUser.id}`;
    if(logoutBtn) logoutBtn.style.display = '';
    if(loginBtn) loginBtn.style.display = 'none';
    if(signupBtn) signupBtn.style.display = 'none';
    if(emailEl) emailEl.style.display = 'none';
    if(passEl) passEl.style.display = 'none';
  }else{
    statusEl.textContent = 'Not logged in';
    if(logoutBtn) logoutBtn.style.display = 'none';
    if(loginBtn) loginBtn.style.display = '';
    if(signupBtn) signupBtn.style.display = '';
    if(emailEl) emailEl.style.display = '';
    if(passEl) passEl.style.display = '';
  }
}

async function login(){
  const email = document.getElementById('authEmail')?.value?.trim();
  const password = document.getElementById('authPassword')?.value;
  if(!email || !password) return alert('Enter email + password');
  const { error } = await client.auth.signInWithPassword({ email, password });
  if(error) alert(error.message);
}

async function signup(){
  const email = document.getElementById('authEmail')?.value?.trim();
  const password = document.getElementById('authPassword')?.value;
  if(!email || !password) return alert('Enter email + password');
  const { error } = await client.auth.signUp({ email, password });
  if(error) alert(error.message);
  else alert('Sign up successful. If email confirmation is enabled, check your inbox.');
}

async function logout(){
  const { error } = await client.auth.signOut();
  if(error) alert(error.message);
}

// --- User results (per account) ---
async function loadUserResults(){
  if(!currentUser){
    userResultsByTipId = {};
    return;
  }
  const { data, error } = await client
    .from('user_results')
    .select('id, tip_id, stake, result')
    .eq('user_id', currentUser.id);

  if(error){
    console.error(error);
    userResultsByTipId = {};
    return;
  }
  userResultsByTipId = {};
  (data || []).forEach(r => { userResultsByTipId[String(r.tip_id)] = r; });
}

async function saveUserResult(tipId, patch){
  if(!currentUser){
    alert('Please log in first so your results save to your account.');
    return;
  }
  const key = String(tipId);
  const existing = userResultsByTipId[key];

  const payload = {
    user_id: currentUser.id,
    tip_id: Number(tipId),
    stake: Number.isFinite(patch.stake) ? patch.stake : (existing?.stake ?? 0),
    result: patch.result ?? (existing?.result ?? 'pending')
  };

  // If user chose "delete", remove their row (resets to defaults)
  if(payload.result === 'delete'){
    const { error } = await client.from('user_results')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('tip_id', Number(tipId));
    if(error) alert(error.message);
    delete userResultsByTipId[key];
    return;
  }

  if(existing?.id){
    const { data, error } = await client
      .from('user_results')
      .update({ stake: payload.stake, result: payload.result })
      .eq('id', existing.id)
      .select('id, tip_id, stake, result')
      .single();
    if(error) alert(error.message);
    else userResultsByTipId[key] = data;
  }else{
    const { data, error } = await client
      .from('user_results')
      .insert(payload)
      .select('id, tip_id, stake, result')
      .single();
    if(error) alert(error.message);
    else userResultsByTipId[key] = data;
  }
}


const bankrollElem=document.getElementById("bankroll");
const profitElem=document.getElementById("profit");
const roiElem=document.getElementById("roi");
const winrateElem=document.getElementById("winrate");
const winsElem=document.getElementById("wins");
const lossesElem=document.getElementById("losses");
const avgOddsElem=document.getElementById("avgOdds");
const profitCard=document.getElementById("profitCard");

tabBets.onclick=()=>switchTab(true);
tabTracker.onclick=()=>switchTab(false);

function switchTab(show){
  initChartTabs();
betsSection.style.display=show?"block":"none";
trackerSection.style.display=show?"none":"block";
tabBets.classList.toggle("active",show);
tabTracker.classList.toggle("active",!show);
}

async function loadBets(){
const {data}=await client.from("value_bets").select("*").order("bet_date",{ascending:false});
betsGrid.innerHTML="";
if(!data) return;
data.forEach(row=>{
betsGrid.innerHTML+=`
<div class="card">
<h3>${row.match}</h3>
<p>${row.market} • ${row.bet_date}</p>
<p>Odds: ${row.odds}</p>
<button onclick='addToTracker(${JSON.stringify(row)})'>Add to Tracker</button>
</div>`;
});
}

async function addToTracker(row){
await client.from("bet_tracker").insert({
match:row.match,
market:row.market,
odds:row.odds,
stake:10,
result:"pending"
});
loadTracker();
}

// ===== Insights (dropdown) =====
const insightStore = {
  bestMarket: { label: "Best Market", value: "—" },
  worstMarket: { label: "Worst Market", value: "—" },
  bestMonth:  { label: "Best Month",  value: "—" },
  worstMonth: { label: "Worst Month", value: "—" },
};

function setInsight(key, value){
  if(!insightStore[key]) return;
  insightStore[key].value = value;
  const hidden = document.getElementById(key);
  if(hidden) hidden.textContent = value;
}

function updateInsightUI(){
  const sel = document.getElementById("insightSelect");
  const labelEl = document.getElementById("insightLabel");
  const valueEl = document.getElementById("insightValue");
  if(!sel || !labelEl || !valueEl) return;
  const key = sel.value || "bestMarket";
  labelEl.textContent = insightStore[key]?.label || "Insights";
  valueEl.textContent = insightStore[key]?.value || "—";
}

document.addEventListener("change", (e)=>{
  if(e.target && e.target.id === "insightSelect"){
    updateInsightUI();
  }
});

let dailyChart;
let monthlyChart;
let marketChart;

function renderDailyChart(history, labels){
if(dailyChart) dailyChart.destroy();
const ctx=document.getElementById("chart").getContext("2d");
dailyChart=new Chart(ctx,{
type:"line",
data:{
labels:(labels && labels.length===history.length) ? labels : history.map((_,i)=>i+1),
datasets:[{
data:history,
tension:0.25,
fill:true,
backgroundColor:"rgba(34,197,94,0.08)",
borderColor:"#22c55e",
borderWidth:2,
pointRadius:0
}]
},
options:{responsive:true,
        maintainAspectRatio:false,plugins:{legend:{display:false}}}
});
}


async function loadTracker(){
  const {data: tips, error} = await client
    .from("bet_tracker")
    .select("*")
    .order("created_at",{ascending:true});

  if(error){
    console.error(error);
    return;
  }

  await loadUserResults();

  const data = (tips||[]).map(t => {
    const ur = userResultsByTipId[String(t.id)];
    return {
      ...t,
      stake: Number(ur?.stake ?? 0),
      result: (ur?.result ?? "pending")
    };
  });

  let start=parseFloat(document.getElementById("startingBankroll").value);
  let bankroll=start,profit=0,wins=0,losses=0,totalStake=0,totalOdds=0,history=[];

  let html="<table><tr><th>Match</th><th>Stake</th><th>Result</th><th class='profit-col'>Profit</th></tr>";

  data.forEach(row=>{
    let p=0;
    if(row.result==="won"){p=row.stake*(row.odds-1);wins++;}
    if(row.result==="lost"){p=-row.stake;losses++;}
    profit+=p;totalStake+=row.stake;totalOdds+=row.odds;
    bankroll=start+profit;history.push(bankroll);

    html+=`<tr>
      <td>${row.match}</td>
      <td><input type="number" value="${row.stake}" onchange="updateStake('${row.id}',this.value)"></td>
      <td>
        <select 
          class="result-select result-${row.result}" 
          onchange="updateResult('${row.id}',this.value)">
          <option value="pending" ${row.result==="pending"?"selected":""}>pending</option>
          <option value="won" ${row.result==="won"?"selected":""}>won</option>
          <option value="lost" ${row.result==="lost"?"selected":""}>lost</option>
          <option value="delete">🗑 delete</option>
        </select>
      </td>
      <td class="profit-col">
        <span class="${p>0?'profit-win':p<0?'profit-loss':''}">£${p.toFixed(2)}</span>
      </td>
    </tr>`;
  });

  html+="</table>";
  trackerTable.innerHTML=html;

  bankrollElem.innerText=bankroll.toFixed(2);
  profitElem.innerText=profit.toFixed(2);
  roiElem.innerText=totalStake?((profit/totalStake)*100).toFixed(1):0;
  winrateElem.innerText=(wins+losses)?((wins/(wins+losses))*100).toFixed(1):0;
  winsElem.innerText=wins;
  lossesElem.innerText=losses;

  const settledCount = wins + losses;
  avgOddsElem.innerText=settledCount?(data.filter(r=>r.result==='won'||r.result==='lost').reduce((s,r)=>s+r.odds,0)/settledCount).toFixed(2):0;

  profitCard.classList.remove("glow-green","glow-red");
  if(profit>0) profitCard.classList.add("glow-green");
  if(profit<0) profitCard.classList.add("glow-red");

  // Daily labels as dates
  const dailyLabels = data.map(r=>{
    const d = new Date(r.created_at);
    return d.toLocaleDateString('en-GB',{day:'2-digit', month:'short'});
  });
  renderDailyChart(history, dailyLabels);

  // ---- Monthly & Market analytics (tabs + mini summary) ----
  const countElem = document.getElementById("betCount");
  if(countElem) countElem.textContent = String(data.length);

  // Monthly profit aggregation (ROI version)
  const monthMap = {};
  const monthStakeMap = {};

  data.forEach(r=>{
    const d = new Date(r.created_at);
    const key = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
    monthMap[key] = (monthMap[key]||0) + rowProfit(r);
    monthStakeMap[key] = (monthStakeMap[key]||0) + r.stake;
  });

  const monthKeys = Object.keys(monthMap).sort();

  const monthLabels = monthKeys.map(k=>{
    const [y,m]=k.split("-");
    return new Date(parseInt(y), parseInt(m)-1, 1)
      .toLocaleDateString('en-GB',{month:'short', year:'2-digit'});
  });

  const monthlyProfit = monthKeys.map(k=> monthMap[k]);
  const monthlyROI = monthKeys.map(k=>{
    const stake = monthStakeMap[k] || 0;
    return stake ? (monthMap[k] / stake) * 100 : 0;
  });

  renderMonthlyChart(monthlyProfit, monthlyROI, monthLabels);

  let breakdownHTML = "<table><tr><th>Month</th><th>Profit</th><th>ROI</th></tr>";
  monthKeys.forEach((k,i)=>{
    const p = monthlyProfit[i];
    const r = monthlyROI[i];
    breakdownHTML += `<tr>
      <td>${monthLabels[i]}</td>
      <td class="${p>0?'profit-win':p<0?'profit-loss':''}">£${p.toFixed(2)}</td>
      <td>${r.toFixed(1)}%</td>
    </tr>`;
  });
  breakdownHTML += "</table>";
  const tableEl = document.getElementById("monthlyTable");
  if(tableEl) tableEl.innerHTML = breakdownHTML;

  // Market profit aggregation
  const marketMap = {};
  const marketWL = {}; // {market:{wins,losses,pending,bets}}
  data.forEach(r=>{
    const mk = (r.market && String(r.market).trim()) ? String(r.market).trim() : "Unknown";
    marketMap[mk] = (marketMap[mk]||0) + rowProfit(r);

    if(!marketWL[mk]) marketWL[mk] = {wins:0,losses:0,pending:0,bets:0};
    marketWL[mk].bets += 1;
    const res = (r.result || "pending").toLowerCase();
    if(res === "won") marketWL[mk].wins += 1;
    else if(res === "lost") marketWL[mk].losses += 1;
    else marketWL[mk].pending += 1;
  });

  // Build win% series (resolved only); show top 8 by bet count
  let entries = Object.entries(marketWL);
  entries.sort((a,b)=>(b[1].bets)-(a[1].bets));
  entries = entries.slice(0,8);

  const labels = entries.map(e=>e[0]);
  const totals = entries.map(e=>({ bets:e[1].bets, wins:e[1].wins, losses:e[1].losses }));
  const winPct = entries.map(e=>{
    const resolved = e[1].wins + e[1].losses;
    return resolved ? (e[1].wins / resolved) * 100 : 0;
  });
  renderMarketChart(labels, winPct, totals);

  // Mini summary
  if(entries.length){
    const bestM = [...Object.entries(marketMap)].sort((a,b)=>b[1]-a[1])[0];
    const worstM = [...Object.entries(marketMap)].sort((a,b)=>a[1]-b[1])[0];
    setMiniValue("bestMarket", bestM[0]+":", (bestM[1] >= 0 ? "+£" : "-£") + Math.abs(bestM[1]).toFixed(2));
    setMiniValue("worstMarket", worstM[0]+":", (worstM[1] >= 0 ? "+£" : "-£") + Math.abs(worstM[1]).toFixed(2));
  }
  if(monthKeys.length){
    const monthEntries = monthKeys.map(k=>[k, monthMap[k]]);
    const bestMo = [...monthEntries].sort((a,b)=>b[1]-a[1])[0];
    const worstMo = [...monthEntries].sort((a,b)=>a[1]-b[1])[0];
    const fmtMonth = (k)=>{
      const [y,m]=k.split("-");
      return new Date(parseInt(y), parseInt(m)-1, 1).toLocaleDateString('en-GB',{month:'short', year:'2-digit'});
    };
    setMiniValue("bestMonth", fmtMonth(bestMo[0])+":", (bestMo[1] >= 0 ? "+£" : "-£") + Math.abs(bestMo[1]).toFixed(2));
    setMiniValue("worstMonth", fmtMonth(worstMo[0])+":", (worstMo[1] >= 0 ? "+£" : "-£") + Math.abs(worstMo[1]).toFixed(2));
  }
}




async function updateStake(id,value){
  const stake = parseFloat(value)||0;
  await saveUserResult(id,{ stake });
  await loadTracker();
}



async function updateResult(id,value){
  await saveUserResult(id,{ result:value });
  await loadTracker();
}


function exportCSV(){
client.from("bet_tracker").select("*").then(({data})=>{
let csv="match,market,odds,stake,result\n";
data.forEach(r=>{
csv+=`${r.match},${r.market},${r.odds},${r.stake},${r.result}\n`;
});
const blob=new Blob([csv],{type:"text/csv"});
const url=URL.createObjectURL(blob);
const a=document.createElement("a");
a.href=url;
a.download="bet_tracker.csv";
a.click();
});
}

loadBets();
initAuth().then(()=>loadTracker());


// Toggle with animation + memory
function toggleTracker(){
  const wrapper = document.getElementById("trackerWrapper");
  const arrow = document.getElementById("trackerArrow");

  if(wrapper.classList.contains("collapsed")){
    wrapper.classList.remove("collapsed");
    wrapper.classList.add("expanded");
    arrow.innerText="▲";
    localStorage.setItem("tracker_open","true");
  }else{
    wrapper.classList.remove("expanded");
    wrapper.classList.add("collapsed");
    arrow.innerText="▼";
    localStorage.setItem("tracker_open","false");
  }
}

// Restore state on load
document.addEventListener("DOMContentLoaded",function(){
  const wrapper=document.getElementById("trackerWrapper");
  const arrow=document.getElementById("trackerArrow");
  const open=localStorage.getItem("tracker_open");
  if(open==="true"){
    wrapper.classList.remove("collapsed");
    wrapper.classList.add("expanded");
    arrow.innerText="▲";
  }
});

// Extend loadTracker to update bet count
const originalLoadTracker = loadTracker;
loadTracker = async function(){
  await originalLoadTracker();
  const rows=document.querySelectorAll("#trackerTable table tr").length-1;
  const count=document.getElementById("betCount");
  if(count && rows>=0){count.innerText=rows;}
};




function renderMonthlyChart(profits, roi, labels){
  const el = document.getElementById("monthlyChart");
  if(!el) return;
  if(monthlyChart) monthlyChart.destroy();

  const maxROI = Math.max(...roi, 5);
  const minROI = Math.min(...roi, -5);
  const pad = 5;

  const ctx = el.getContext("2d");

  monthlyChart = new Chart(ctx,{
    type:"bar",
    data:{
      labels:labels,
      datasets:[{
        data:roi,
        borderRadius:10,
        barThickness:24,
        backgroundColor:profits.map(v=>{
          if(v>0) return "rgba(34,197,94,0.9)";
          if(v<0) return "rgba(239,68,68,0.9)";
          return "rgba(100,116,139,0.4)";
        })
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        y:{
          min: Math.floor(minROI - pad),
          max: Math.ceil(maxROI + pad),
          ticks:{callback:(v)=>v+"%"},
          grid:{color:"rgba(255,255,255,0.05)"}
        }
      }
    },
    plugins:[{
      afterDatasetsDraw(chart){
        const {ctx} = chart;
        chart.getDatasetMeta(0).data.forEach((bar,i)=>{
          const val = profits[i];
          if(val === 0) return;
          ctx.fillStyle="#fff";
          ctx.font="bold 13px system-ui";
          ctx.textAlign="center";
          ctx.fillText("£"+val.toFixed(0), bar.x, roi[i]>=0 ? bar.y-8 : bar.y+18);
        });
      }
    }]
  });
}


function renderMarketChart(labels, winPct, totals){
  const el = document.getElementById("marketChart");
  if(!el) return;
  if(marketChart) marketChart.destroy();

  const ctx = el.getContext("2d");
  marketChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: winPct,
        borderWidth: 0,
        borderRadius: 10,
        barThickness: 18,
        backgroundColor: winPct.map(v=>{
          if(v >= 55) return "rgba(34,197,94,0.85)";   // green
          if(v >= 40) return "rgba(245,158,11,0.85)";  // amber
          return "rgba(239,68,68,0.85)";               // red
        }),
        borderColor: winPct.map(v=>{
          if(v >= 55) return "#22c55e";
          if(v >= 40) return "#f59e0b";
          return "#ef4444";
        })
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx)=>{
              const i = ctx.dataIndex;
              const pct = Number(ctx.raw || 0).toFixed(0) + "%";
              const t = (totals && totals[i]) ? totals[i] : { bets: 0, wins: 0, losses: 0 };
              return `Win rate: ${pct} • Bets: ${t.bets} (W:${t.wins} L:${t.losses})`;
            }
          }
        }
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: { display: false },
          grid: { display: false, drawBorder: false }
        },
        y: {
          ticks: { color: "rgba(229,231,235,0.85)", font: { weight: 800 } },
          grid: { display: false, drawBorder: false }
        }
      },
      animation: { duration: 250 }
    },
    plugins: [{
      id: "pctLabels",
      afterDatasetsDraw(chart){
        const {ctx} = chart;
        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.font = "800 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.fillStyle = "rgba(229,231,235,0.95)";
        meta.data.forEach((bar, i)=>{
          const val = winPct[i] ?? 0;
          const text = Math.round(val) + "%";
          const x = bar.x - 10; // inside bar near end
          const y = bar.y + 4;
          ctx.textAlign = "right";
          ctx.fillText(text, x, y);
        });
        ctx.restore();
      }
    }]
  });
}

function setMiniValue(id, prefix, value){
  // legacy helper kept, now feeds Insights dropdown
  const txt = (prefix ? (prefix + " ") : "") + (value || "—");
  setInsight(id, txt);
  updateInsightUI();
}




function initChartTabs(){
  const btns = document.querySelectorAll(".tab-btn");
  if(!btns.length) return;

  btns.forEach(b=>{
    b.addEventListener("click", ()=>{
      btns.forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      const tab = b.getAttribute("data-tab");
      document.querySelectorAll(".chart-pane").forEach(p=>p.classList.remove("active"));
      const pane = document.getElementById("pane-"+tab);
      if(pane) pane.classList.add("active");
    });
  });
}


function rowProfit(row){
  if(row.result === "won") return row.stake * (row.odds - 1);
  if(row.result === "lost") return -row.stake;
  return 0;
}


function toggleInsights(){
  const content = document.getElementById("insightsContent");
  const arrow = document.getElementById("insightsArrow");

  if(content.classList.contains("insights-collapsed")){
    content.classList.remove("insights-collapsed");
    content.classList.add("insights-expanded");
    arrow.innerText="▲";
  }else{
    content.classList.remove("insights-expanded");
    content.classList.add("insights-collapsed");
    arrow.innerText="▼";
  }
}


// Auto-close Insights when switching chart tabs
document.addEventListener("click", function(e){
  if(e.target.classList.contains("tab-btn")){
    const content = document.getElementById("insightsContent");
    const arrow = document.getElementById("insightsArrow");
    if(content && !content.classList.contains("insights-collapsed")){
      content.classList.remove("insights-expanded");
      content.classList.add("insights-collapsed");
      arrow.innerText="▼";
    }
  }
});

function toggleMonthly(){
  const wrapper=document.getElementById("monthlyWrapper");
  const arrow=document.getElementById("monthlyArrow");
  if(wrapper.classList.contains("collapsed")){
    wrapper.classList.remove("collapsed");
    wrapper.classList.add("expanded");
    arrow.innerText="▲";
  }else{
    wrapper.classList.remove("expanded");
    wrapper.classList.add("collapsed");
    arrow.innerText="▼";
  }
}
const startingInput = document.getElementById("startingBankroll");

if(startingInput){
  // Load saved value
  const saved = localStorage.getItem("starting_bankroll");
  if(saved){
    startingInput.value = saved;
  }

  // Save on change
  startingInput.addEventListener("input", function(){
    localStorage.setItem("starting_bankroll", this.value);
  });
}

// --- Export key handlers for inline buttons (mobile-safe) ---
// index.html uses onclick="login()" / "signup()" / "logout()".
// Exposing them on window avoids "button does nothing" when listeners fail.
window.login = login;
window.signup = signup;
window.logout = logout;
window.addToTracker = addToTracker;
window.removeFromTracker = removeFromTracker;
window.toggleInsights = toggleInsights;
window.toggleMonthly = toggleMonthly;