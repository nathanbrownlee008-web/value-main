
const SUPABASE_URL="https://krmmmutcejnzdfupexpv.supabase.co";
const SUPABASE_KEY="sb_publishable_3NHjMMVw1lai9UNAA-0QZA_sKM21LgD";
const client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const savedBankroll=localStorage.getItem("starting_bankroll");
if(savedBankroll){startingBankroll.value=savedBankroll;}

startingBankroll.addEventListener("input",function(){
localStorage.setItem("starting_bankroll",this.value);
loadTracker();
});

tabBets.onclick=()=>switchTab(true);
tabTracker.onclick=()=>switchTab(false);

function switchTab(show){
betsSection.style.display=show?"block":"none";
trackerSection.style.display=show?"none":"block";
tabBets.classList.toggle("active",show);
tabTracker.classList.toggle("active",!show);
}

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
tension:0.4,
fill:true,
backgroundColor:"rgba(34,197,94,0.15)",
borderColor:"#22c55e",
borderWidth:3
}]
},
options:{responsive:true,plugins:{legend:{display:false}}}
});
}

// (rest of JS identical safe logic from previous working version)

