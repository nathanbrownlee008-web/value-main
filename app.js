
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

async function loadBets(){
  const {data}=await client.from("value_bets").select("*").order("bet_date",{ascending:false});
  const betsGrid=document.getElementById("betsGrid");
  betsGrid.innerHTML="";
  if(!data) return;

  data.forEach(row=>{
    betsGrid.innerHTML += `
    <div class="bet-card">
      <div class="bet-top">
        <div class="bet-match">${row.match}</div>
        <div class="bet-date">${row.bet_date}</div>
      </div>

      <div class="bet-market">
        ${row.market}
      </div>

      <div class="bet-odds">
        ${row.odds}
      </div>

      <button class="bet-btn" onclick='addToTracker(${JSON.stringify(row)})'>
        + Add to Tracker
      </button>
    </div>`;
  });
}

async function addToTracker(row){
  await client.from("bet_tracker").insert({
    match:row.match,
    market:row.market,
    odds:row.odds,
    match_date_date: row.bet_date,
    stake:10,
    result:"pending"
  });
  alert("Added to tracker");
}

document.addEventListener("DOMContentLoaded", () => {
  loadBets();
});
