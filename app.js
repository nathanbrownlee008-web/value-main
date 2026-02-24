
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

let chart;

function renderChart(history){
if(chart) chart.destroy();
const ctx=document.getElementById("chart").getContext("2d");
chart=new Chart(ctx,{
type:"line",
data:{
labels:data.map(r=> new Date(r.created_at).toLocaleDateString()),
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
options:{
        responsive:true,
        plugins:{legend:{display:false}},
        scales:{
            y:{
                ticks:{
                    callback:function(value){return '£'+value;}
                }
            }
        }
    }
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

renderChart(history);
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


// Force tracker open by default (still collapsible manually)
document.addEventListener("DOMContentLoaded", function(){
  const wrapper=document.getElementById("trackerWrapper");
  const arrow=document.getElementById("trackerArrow");
  if(wrapper){
    wrapper.classList.remove("collapsed");
    wrapper.classList.add("expanded");
    arrow.innerText="▲";
  }
});
