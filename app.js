
const SUPABASE_URL = "https://krmmmmtcejnzdfupexpv.supabase.co";
const SUPABASE_KEY = "sb_publishable_3NHjMMVw1lai9UNAA-0QZA_sKM21LgD";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const betsDiv = document.getElementById("bets");

async function loadBets() {
  const { data, error } = await client
    .from("value_bets")
    .select("*")
    .order("created_at", { ascending: false });

  console.log("DATA:", data);
  console.log("ERROR:", error);

  if (!data || data.length === 0) {
    betsDiv.innerHTML = "<p>No games found</p>";
    return;
  }

  betsDiv.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Match</th>
          <th>Market</th>
          <th>Odds</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(row => `
          <tr>
            <td>${row.bet_date ?? "-"}</td>
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
