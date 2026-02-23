
const SUPABASE_URL="https://krmmmutcejnzdfupexpv.supabase.co";
const SUPABASE_KEY="YOUR_PUBLIC_ANON_KEY";
const client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

document.getElementById("tabBets").onclick=()=>switchTab(true);
document.getElementById("tabTracker").onclick=()=>switchTab(false);

document.getElementById("toggleTracker").onclick=()=>{
const content=document.getElementById("trackerContent");
content.style.display=content.style.display==="none"?"block":"none";
};

function switchTab(show){
betsSection.style.display=show?"block":"none";
trackerSection.style.display=show?"none":"block";
tabBets.classList.toggle("active",show);
tabTracker.classList.toggle("active",!show);
}

async function loadBankroll(){
const {data}=await client.from("bankroll").select("*").limit(1);
if(!data || data.length===0){
await client.from("bankroll").insert({starting_bankroll:1000,current_bankroll:1000});
return 1000;
}
return data[0].current_bankroll;
}

async function updateBankroll(value){
await client.from("bankroll").update({current_bankroll:value});
}

let chart;

async function loadTracker(){
const {data}=await client.from("bet_tracker").select("*").order("created_at",{ascending:true});

let bankroll=await loadBankroll();
let profit=0;
let wins=0;
let losses=0;
let totalStake=0;
let history=[];

let html="<table><tr><th>Match</th><th>Stake</th><th>Result</th><th>Profit</th></tr>";

data.forEach(row=>{
let p=0;
if(row.result==="won"){p=row.stake*(row.odds-1);wins++;}
if(row.result==="lost"){p=-row.stake;losses++;}

profit+=p;
totalStake+=row.stake;
bankroll+=p;
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
<td class="${p>0?'profit-win':p<0?'profit-loss':''}">£${p.toFixed(2)}</td>
</tr>`;
});

html+="</table>";
trackerTable.innerHTML=html;

document.getElementById("bankroll").innerText=bankroll.toFixed(2);
document.getElementById("profit").innerText=profit.toFixed(2);
document.getElementById("roi").innerText=totalStake?((profit/totalStake)*100).toFixed(1):0;
document.getElementById("winrate").innerText=(wins+losses)?((wins/(wins+losses))*100).toFixed(1):0;
document.getElementById("wins").innerText=wins;
document.getElementById("losses").innerText=losses;

await updateBankroll(bankroll);
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

loadTracker();
