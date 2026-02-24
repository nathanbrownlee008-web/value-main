
const SUPABASE_URL="https://krmmmutcejnzdfupexpv.supabase.co";
const SUPABASE_KEY="sb_publishable_3NHjMMVw1lai9UNAA-0QZA_sKM21LgD";
const client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

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
  initInsightDropdown();
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
const {data}=await client.from("bet_tracker").select("*").order("created_at",{ascending:true});

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
avgOddsElem.innerText=data.length?(totalOdds/data.length).toFixed(2):0;

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

// Monthly profit aggregation
const monthMap = {};
data.forEach(r=>{
  const d = new Date(r.created_at);
  const key = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
  monthMap[key] = (monthMap[key]||0) + rowProfit(r);
});
const monthKeys = Object.keys(monthMap).sort();
let run = 0;
const monthLabels = monthKeys.map(k=>{
  const [y,m]=k.split("-");
  return new Date(parseInt(y), parseInt(m)-1, 1).toLocaleDateString('en-GB',{month:'short', year:'2-digit'});
});
const monthlyBankroll = monthKeys.map(k=>{
  run += monthMap[k];
  return Number((start + run).toFixed(2));
});
renderMonthlyChart(monthlyBankroll, monthLabels);

// Market profit aggregation
const marketMap = {};
data.forEach(r=>{
  const mk = (r.market && String(r.market).trim()) ? String(r.market).trim() : "Unknown";
  marketMap[mk] = (marketMap[mk]||0) + rowProfit(r);
});
let entries = Object.entries(marketMap);
entries.sort((a,b)=>Math.abs(b[1]) - Math.abs(a[1]));
entries = entries.slice(0,8);
renderMarketChart(entries.map(e=>e[0]), entries.map(e=>Number(e[1].toFixed(2))));

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


async function updateStake(id,val){
await client.from("bet_tracker").update({stake:parseFloat(val)}).eq("id",id);
loadTracker();
}

async function updateResult(id,val){
if(val==="delete"){
if(!confirm("Delete this bet?")){loadTracker();return;}
await client.from("bet_tracker").delete().eq("id",id);
}else{
await client.from("bet_tracker").update({result:val}).eq("id",id);
}
loadTracker();
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
loadTracker();


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

  updateInsightUI();
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


function renderMonthlyChart(monthlyBankroll, monthLabels){
  const el = document.getElementById("monthlyChart");
  if(!el) return;
  if(monthlyChart) monthlyChart.destroy();

  const ctx = el.getContext("2d");
  monthlyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: monthLabels,
      datasets: [{
        data: monthlyBankroll,
        tension: 0.25,
        fill: true,
        backgroundColor: "rgba(34,197,94,0.08)",
        borderColor: "#22c55e",
        borderWidth: 2,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: (v)=>'£'+v } }
      }
    }
  });
}

function renderMarketChart(labels, winPct){
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
        backgroundColor: "rgba(34,197,94,0.16)",
        borderColor: "#22c55e",
        borderWidth: 2,
        borderRadius: 10,
        barThickness: 18,
        maxBarThickness: 18
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx)=> `${ctx.parsed.x.toFixed(0)}% win rate`
          }
        }
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: { display: false },
          grid: { display: false, drawBorder: false },
          border: { display: false }
        },
        y: {
          ticks: { color: "rgba(226,232,240,0.9)", font: { weight: "800" } },
          grid: { display: false },
          border: { display: false }
        }
      }
    },
    plugins: [insideLabelPlugin]
  });
}

function setMiniValue(id, label, value){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = label + " " + value;
  el.classList.remove("positive","negative");
  if(value.startsWith("+£")) el.classList.add("positive");
  if(value.startsWith("-£")) el.classList.add("negative");
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


const insideLabelPlugin = {
  id: "insideLabelPlugin",
  afterDatasetsDraw(chart, args, pluginOptions) {
    const { ctx } = chart;
    ctx.save();
    const dataset = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    meta.data.forEach((bar, i) => {
      const val = dataset.data[i];
      const label = (typeof val === "number") ? (val.toFixed(0) + "%") : String(val);
      const pos = bar.tooltipPosition();
      ctx.font = "800 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillStyle = "rgba(226,232,240,0.95)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // place inside bar near the end
      ctx.fillText(label, pos.x - 18, pos.y);
    });
    ctx.restore();
  }
};


function updateInsightUI(){
  const sel = document.getElementById("insightSelect");
  const labelEl = document.getElementById("insightLabel");
  const valEl = document.getElementById("insightValue");
  if(!sel || !labelEl || !valEl) return;

  const map = {
    bestMarket: { label: "Best Market", source: document.getElementById("bestMarket") },
    worstMarket: { label: "Worst Market", source: document.getElementById("worstMarket") },
    bestMonth: { label: "Best Month", source: document.getElementById("bestMonth") },
    worstMonth: { label: "Worst Month", source: document.getElementById("worstMonth") }
  };

  const chosen = map[sel.value] || map.bestMarket;
  labelEl.textContent = chosen.label;
  const txt = chosen.source ? chosen.source.textContent : "—";
  valEl.textContent = txt;

  valEl.classList.remove("positive","negative");
  if(txt.includes("+£")) valEl.classList.add("positive");
  if(txt.includes("-£")) valEl.classList.add("negative");
}


function initInsightDropdown(){
  const sel = document.getElementById("insightSelect");
  if(!sel) return;
  sel.addEventListener("change", updateInsightUI);
  updateInsightUI();
}
