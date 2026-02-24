
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

let chart;

function renderChart(history){
if(chart) chart.destroy();
const ctx=document.getElementById("chart").getContext("2d");
chart=new Chart(ctx,{
type:"line",
data:{
labels:history.map((_,i)=>i+1),
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
options:{responsive:true,plugins:{legend:{display:false}}}
});
}

async function loadTracker(){
const {data}=await client.from("bet_tracker").select("*").order("created_at",{ascending:true});

let start=parseFloat(document.getElementById("startingBankroll").value);
let bankroll=start,profit=0,wins=0,losses=0,totalStake=0,totalOdds=0,history=[];

let html="<table><tr><th>Match</th><th>Stake</th><th>Result</th><th>Profit</th></tr>";

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
<select class="result-select" onchange="updateResult('${row.id}',this.value)">
<option value="pending" ${row.result==="pending"?"selected":""}>pending</option>
<option value="won" ${row.result==="won"?"selected":""}>won</option>
<option value="lost" ${row.result==="lost"?"selected":""}>lost</option>
</select>
</td>
<td class="profit-cell">
<span class="${p>0?'profit-win':p<0?'profit-loss':''}">£${p.toFixed(2)}</span>
<button class="delete-btn" onclick="deleteBet('${row.id}')">✕</button>
</td>
</tr>`;
});

html+="</table>";
document.getElementById("trackerTable").innerHTML=html;

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
await client.from("bet_tracker").update({result:val}).eq("id",id);
loadTracker();
}

async function deleteBet(id){
if(!confirm("Delete this bet?")) return;
await client.from("bet_tracker").delete().eq("id",id);
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

loadTracker();
