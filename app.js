const SUPABASE_URL = "https://krmmmmtcejnzdfupexpv.supabase.co";
const SUPABASE_KEY = "sb_publishable_3NHjMMVw1lai9UNAA-0QZA_sKM21LgD";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const betsGrid = document.getElementById("betsGrid");

function showTab(id){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function loadBets(){
  const { data, error } = await client
    .from("value_bets")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    betsGrid.innerHTML = "Error loading bets";
    console.error(error);
    return;
  }

  if(!data || data.length === 0){
    betsGrid.innerHTML = "<p>No games found</p>";
    return;
  }

  betsGrid.innerHTML = `
  <table class="value-table">
    <thead>
      <tr>
        <th>Date</th>
        <th>League</th>
        <th>Match</th>
        <th>Market</th>
        <th>Odds</th>
      </tr>
    </thead>
    <tbody>
      ${data.map(row=>`
        <tr>
          <td>${row.bet_date ?? "-"}</td>
          <td>${row.league ?? "-"}</td>
          <td>${row.match}</td>
          <td>${row.market}</td>
          <td>${row.odds}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  `;
}

loadBets();
