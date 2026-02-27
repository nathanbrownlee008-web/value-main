// ===== SUPABASE CONFIG =====
// Replace with your project values
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loadBets() {
  const { data, error } = await client
    .from("value_bets")
    .select("bet_date, match, market, odds")
    .order("bet_date", { ascending: true });

  if (error) {
    console.error("Fetch error:", error);
    return;
  }

  const tbody = document.querySelector("#betsTable tbody");
  tbody.innerHTML = "";

  data.forEach(bet => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${bet.bet_date ?? ""}</td>
      <td>${bet.match ?? ""}</td>
      <td>${bet.market ?? ""}</td>
      <td>${bet.odds ?? ""}</td>
      <td><button>Add</button></td>
    `;
    tbody.appendChild(tr);
  });

  console.log("Loaded bets:", data.length);
}

loadBets();
