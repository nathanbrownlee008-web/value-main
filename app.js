
const SUPABASE_URL="https://krmmmutcejnzdfupexpv.supabase.co";
const SUPABASE_KEY="sb_publishable_3NHjMMVw1lai9UNAA-0QZA_sKM21LgD";
const client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const savedBankroll = localStorage.getItem("starting_bankroll");
if(savedBankroll){
  document.getElementById("startingBankroll").value = savedBankroll;
}

document.getElementById("startingBankroll").addEventListener("input", function(){
  localStorage.setItem("starting_bankroll", this.value);
  loadTracker();
});

document.getElementById("tabBets").onclick=()=>switchTab(true);
document.getElementById("tabTracker").onclick=()=>switchTab(false);

function switchTab(show){
betsSection.style.display=show?"block":"none";
trackerSection.style.display=show?"none":"block";
tabBets.classList.toggle("active",show);
tabTracker.classList.toggle("active",!show);
}

async function loadBets(){
const {data}=await client.from("value_bets").select("*").order("bet_date",{ascending:false});
betsGrid.innerHTML="";
data.forEach(row=>{
const card=document.createElement("div");
card.className="card";
card.innerHTML=`
<h3>${row.match}</h3>
<p>${row.market} • ${row.bet_date}</p>
<p>Odds: ${row.odds}</p>
<button onclick='addToTracker(${JSON.stringify(row)})'>Add to Tracker</button>
`;
betsGrid.appendChild(card);
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

let chart;

async function loadTracker(){
const {data}=await client.from("bet_tracker").select("*").order("created_at",{ascending:true});
let start=parseFloat(startingBankroll.value);
let bankroll=start;
let profit=0;
let wins=0;
let losses=0;
let totalStake=0;
let totalOdds=0;
let history=[];

let html="<table><tr><th>Match</th><th>Stake</th><th>Result</th><th>Profit</th></tr>";

data.forEach(row=>{
let p=0;
if(row.result==="won"){p=row.stake*(row.odds-1);wins++;}
if(row.result==="lost"){p=-row.stake;losses++;}
profit+=p;
totalStake+=row.stake;
totalOdds+=row.odds;
bankroll=start+profit;
history.push(bankroll);

html+=`<tr>
<td>${row.match}</td>
<td><input type="number" value="${row.stake}" onchange="updateStake(${row.id},this.value)"/></td>
<td>
<select class="result-select ${row.result}" onchange="updateResult(${row.id},this.value)">
<option value="pending" ${row.result==="pending"?"selected":""}>pending</option>
<option value="won" ${row.result==="won"?"selected":""}>won</option>
<option value="lost" ${row.result==="lost"?"selected":""}>lost</option>
</select>
</td>
<td class="${p > 0 ? 'profit-win' : p < 0 ? 'profit-loss' : ''}">£${p.toFixed(2)}</td>
</tr>`;
});

html+="</table>";
trackerTable.innerHTML=html;

bankrollElem.innerText=bankroll.toFixed(2);
profitElem.innerText=profit.toFixed(2);
roiElem.innerText=totalStake?((profit/totalStake)*100).toFixed(1):0;
winrateElem.innerText=data.length?((wins/data.length)*100).toFixed(1):0;
winsElem.innerText=wins;
lossesElem.innerText=losses;
avgOddsElem.innerText=data.length?(totalOdds/data.length).toFixed(2):0;

renderChart(history);
}

async function updateResult(id,val){
await client.from("bet_tracker").update({result:val}).eq("id",id);
loadTracker();
}

async function updateStake(id,val){
await client.from("bet_tracker").update({stake:parseFloat(val)}).eq("id",id);
loadTracker();
}

function renderChart(history){
if(chart) chart.destroy();
chart=new Chart(document.getElementById("chart"),{
type:"line",
data:{labels:history.map((_,i)=>i+1),datasets:[{data:history,tension:0.4}]},
options:{responsive:true,plugins:{legend:{display:false}}}
});
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

const bankrollElem=document.getElementById("bankroll");
const profitElem=document.getElementById("profit");
const roiElem=document.getElementById("roi");
const winrateElem=document.getElementById("winrate");
const winsElem=document.getElementById("wins");
const lossesElem=document.getElementById("losses");
const avgOddsElem=document.getElementById("avgOdds");

loadBets();
loadTracker();


// Auto-close Insights when switching chart tabs
document.addEventListener("click",function(e){
  if(e.target.classList.contains("tab-btn")){
    const content=document.getElementById("insightsContent");
    const arrow=document.getElementById("insightsArrow");
    if(content && content.classList.contains("insights-expanded")){
      content.classList.remove("insights-expanded");
      content.classList.add("insights-collapsed");
      if(arrow) arrow.innerText="▼";
    }
  }
});
