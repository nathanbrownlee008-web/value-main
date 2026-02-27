
const $ = (id) => document.getElementById(id);

const state = {
  datasets: [],
  current: null,
  raw: [],
  filtered: [],
  columnsAll: [],
  columns: [],
  sortKey: null,
  sortDir: "asc",
  compact: true
};

function normalizeStr(v){ return (v ?? "").toString().toLowerCase(); }

function parseDateOnly(s){
  if(!s) return null;
  // expects "YYYY-MM-DD HH:MM"
  const t = String(s).replace(" ", "T");
  const d = new Date(t + (t.length === 16 ? ":00" : "") + "Z");
  if(Number.isNaN(+d)) return null;
  return d;
}

function formatNum(v, digits=3){
  if(v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if(Number.isNaN(n)) return String(v);
  return n.toFixed(digits).replace(/\.0+$/,"").replace(/(\.\d*[1-9])0+$/,"$1");
}

function setSelectOptions(sel, values, placeholder){
  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholder;
  sel.appendChild(opt0);
  [...values].sort((a,b)=>a.localeCompare(b)).forEach(v=>{
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  });
}

function inferPrimaryCols(cols){
  const want = [
    "Rank","DateUTC (date)","League","Home","Away",
    "P(Over2.5)","P(BTTS)","P(Over1.5)",
    "Model xG Total","Pick"
  ];
  const chosen = [];
  want.forEach(k=>{ if(cols.includes(k) && !chosen.includes(k)) chosen.push(k); });
  if(chosen.length < 6){
    chosen.push(...cols.slice(0, Math.min(10, cols.length)).filter(c=>!chosen.includes(c)));
  }
  return chosen.slice(0, 10);
}

function probColForDataset(){
  if(!state.raw.length) return null;
  const r0 = state.raw[0];
  return ["P(Over2.5)","P(BTTS)","P(Over1.5)"].find(k => k in r0) || null;
}

function buildTabs(){
  const tabs = $("tabs");
  tabs.innerHTML = "";
  state.datasets.forEach(d=>{
    const b = document.createElement("button");
    b.className = "tab";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", state.current?.slug === d.slug ? "true" : "false");
    b.textContent = d.name;
    b.addEventListener("click", ()=> loadDataset(d.slug));
    tabs.appendChild(b);
  });
}

function buildHead(){
  const thead = $("tbl").querySelector("thead");
  thead.innerHTML = "";
  const tr = document.createElement("tr");
  state.columns.forEach(key=>{
    const th = document.createElement("th");
    const arrow = (state.sortKey === key) ? (state.sortDir === "asc" ? " ▲" : " ▼") : "";
    th.textContent = key + arrow;
    th.addEventListener("click", ()=>{
      if(state.sortKey === key){
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      }else{
        state.sortKey = key;
        state.sortDir = "asc";
      }
      render();
    });
    tr.appendChild(th);
  });
  thead.appendChild(tr);
}

function sortData(rows){
  const key = state.sortKey;
  if(!key) return rows;
  const dir = state.sortDir === "asc" ? 1 : -1;

  rows.sort((a,b)=>{
    const av = a[key];
    const bv = b[key];

    if(String(key).toLowerCase().includes("date")){
      const ad = parseDateOnly(av);
      const bd = parseDateOnly(bv);
      return dir * ((ad?.getTime() ?? 0) - (bd?.getTime() ?? 0));
    }

    const an = Number(av);
    const bn = Number(bv);
    if(Number.isFinite(an) && Number.isFinite(bn)) return dir * (an - bn);

    return dir * String(av ?? "").localeCompare(String(bv ?? ""));
  });
  return rows;
}

function applyFilters(){
  const q = normalizeStr($("q").value);
  const league = $("league").value;
  const pick = $("pick").value;
  const pmin = $("pmin").value ? Number($("pmin").value) : null;
  const dfrom = $("dfrom").value ? new Date($("dfrom").value + "T00:00:00Z") : null;
  const dto = $("dto").value ? new Date($("dto").value + "T23:59:59Z") : null;

  const pCol = probColForDataset();
  const dateKey = state.raw.length && (("DateUTC (date)" in state.raw[0]) ? "DateUTC (date)" : null);

  const rows = state.raw.filter(r=>{
    if(league && r.League !== league) return false;
    if(pick && (r.Pick ?? "") !== pick) return false;
    if(pCol && pmin !== null && typeof r[pCol] === "number" && r[pCol] < pmin) return false;

    if((dfrom || dto) && dateKey){
      const d = parseDateOnly(r[dateKey]);
      if(!d) return false;
      if(dfrom && d < dfrom) return false;
      if(dto && d > dto) return false;
    }

    if(q){
      const hay = [r.League, r.Home, r.Away, r.Pick, r[dateKey]].map(normalizeStr).join(" ");
      if(!hay.includes(q)) return false;
    }
    return true;
  });

  state.filtered = sortData(rows);
}

function buildBody(){
  const tbody = $("tbl").querySelector("tbody");
  tbody.innerHTML = "";
  state.filtered.forEach(r=>{
    const tr = document.createElement("tr");
    tr.addEventListener("click", ()=> openDetails(r));
    state.columns.forEach(key=>{
      const td = document.createElement("td");
      const v = r[key];
      const kl = String(key).toLowerCase();
      if(kl.startsWith("p(") && typeof v === "number"){
        td.innerHTML = `<span class="badge mono">${formatNum(v,3)}</span>`;
      }else if(Number.isFinite(Number(v)) && v !== "" && v !== null && v !== undefined){
        td.textContent = (typeof v === "number") ? formatNum(v,3) : formatNum(Number(v),3);
        td.classList.add("mono");
      }else{
        td.textContent = (v ?? "").toString();
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function buildCards(){
  const list = $("cardList");
  list.innerHTML = "";
  const rows = state.filtered;
  if(!rows.length) return;

  const pCol = probColForDataset();
  const dateKey = ("DateUTC (date)" in rows[0]) ? "DateUTC (date)" : null;

  const show = inferPrimaryCols(state.columnsAll);
  rows.forEach(r=>{
    const item = document.createElement("div");
    item.className = "cardItem";
    item.addEventListener("click", ()=> openDetails(r));

    const top = document.createElement("div");
    top.className = "cardTop";

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "cardTitle";
    title.textContent = (r.Home && r.Away) ? `${r.Home} vs ${r.Away}` : (r.League || "Row");
    const sub = document.createElement("div");
    sub.className = "cardSub";
    const parts = [];
    if(r.League) parts.push(r.League);
    if(dateKey && r[dateKey]) parts.push(`${r[dateKey]} UTC`);
    if(r.Pick) parts.push(r.Pick);
    sub.textContent = parts.join(" • ");
    left.appendChild(title);
    left.appendChild(sub);

    const right = document.createElement("div");
    if(pCol && typeof r[pCol] === "number"){
      right.innerHTML = `<span class="badge mono">${formatNum(r[pCol],3)}</span>`;
    }

    top.appendChild(left);
    top.appendChild(right);

    const grid = document.createElement("div");
    grid.className = "cardGrid";
    show.slice(0,6).forEach(k=>{
      if(k === "Home" || k === "Away") return;
      const kv = document.createElement("div");
      const kk = document.createElement("div");
      kk.className = "k";
      kk.textContent = k;
      const vv = document.createElement("div");
      vv.className = "v";
      const val = r[k];
      vv.textContent = (typeof val === "number") ? formatNum(val,3) : (val ?? "").toString();
      kv.appendChild(kk);
      kv.appendChild(vv);
      grid.appendChild(kv);
    });

    item.appendChild(top);
    item.appendChild(grid);
    list.appendChild(item);
  });
}

function openDetails(row){
  $("d_title").textContent = (row.Home && row.Away) ? `${row.Home} vs ${row.Away}` : (state.current?.name ?? "Details");
  $("d_sub").textContent = (row.League ? `${row.League} • ` : "") + (row["DateUTC (date)"] ? `${row["DateUTC (date)"]} (UTC)` : "");

  const wrap = document.createElement("div");
  wrap.className = "kv";
  Object.keys(row).forEach(k=>{
    const kk = document.createElement("div");
    kk.className = "k";
    kk.textContent = k;

    const vv = document.createElement("div");
    vv.className = "v";
    const val = row[k];
    const kl = String(k).toLowerCase();
    if(kl.startsWith("p(") && typeof val === "number"){
      vv.innerHTML = `<span class="badge mono">${formatNum(val,3)}</span>`;
    }else if(Number.isFinite(Number(val)) && val !== "" && val !== null && val !== undefined){
      vv.textContent = (typeof val === "number") ? formatNum(val,6) : formatNum(Number(val),6);
      vv.classList.add("mono");
    }else{
      vv.textContent = (val ?? "").toString();
    }

    wrap.appendChild(kk);
    wrap.appendChild(vv);
  });

  $("d_body").innerHTML = "";
  $("d_body").appendChild(wrap);
  $("details").showModal();
}

function initFilters(){
  const leagues = new Set(state.raw.map(r=>r.League).filter(Boolean));
  const picks = new Set(state.raw.map(r=>r.Pick).filter(Boolean));
  setSelectOptions($("league"), leagues, "All leagues");
  setSelectOptions($("pick"), picks, "All picks");

  $("league").closest(".control").style.display = leagues.size ? "" : "none";
  $("pick").closest(".control").style.display = picks.size ? "" : "none";

  const pCol = probColForDataset();
  $("pminWrap").style.display = pCol ? "" : "none";
  $("pminLabel").textContent = pCol ? `Min ${pCol}` : "Min probability";
}

async function loadDataset(slug){
  const ds = state.datasets.find(d=>d.slug===slug) || state.datasets[0];
  state.current = ds;
  $("status").textContent = "Loading…";
  buildTabs();

  const res = await fetch(ds.file, {cache:"no-store"});
  const json = await res.json();
  state.raw = json.rows || [];
  state.columnsAll = json.columns || (state.raw.length ? Object.keys(state.raw[0]) : []);
  state.columns = inferPrimaryCols(state.columnsAll);
  state.sortKey = state.columns[0] || null;
  state.sortDir = "asc";
  initFilters();
  $("status").textContent = "Offline data (bundled).";
  render();
}

function render(){
  applyFilters();
  buildHead();
  buildBody();
  buildCards();
  $("count").textContent = `${state.filtered.length} of ${state.raw.length} rows • ${state.current?.name ?? ""}`;
}

function resetFilters(){
  $("q").value = "";
  $("league").value = "";
  $("pick").value = "";
  $("pmin").value = "";
  $("dfrom").value = "";
  $("dto").value = "";
  state.sortKey = state.columns[0] || null;
  state.sortDir = "asc";
  render();
}

function setCompact(on){
  state.compact = on;
  document.body.classList.toggle("compact", on);
  $("viewBtn").textContent = on ? "Wide" : "Compact";
  render();
}

async function init(){
  if("serviceWorker" in navigator){
    try{ await navigator.serviceWorker.register("sw.js"); }catch(e){}
  }

  // install prompt
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    $("installBtn").classList.remove("hidden");
  });
  $("installBtn").addEventListener("click", async ()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("installBtn").classList.add("hidden");
  });

  const dsRes = await fetch("datasets.json", {cache:"no-store"});
  state.datasets = await dsRes.json();
  buildTabs();

  // listeners
  ["q","league","pick","pmin","dfrom","dto"].forEach(id=>{
    $(id).addEventListener(id === "q" ? "input" : "change", render);
  });
  $("resetBtn").addEventListener("click", resetFilters);
  $("viewBtn").addEventListener("click", ()=> setCompact(!state.compact));
  $("closeDlg").addEventListener("click", ()=> $("details").close());
  $("details").addEventListener("click", (e)=>{
    const rect = $("details").getBoundingClientRect();
    const inDialog = rect.top <= e.clientY && e.clientY <= rect.bottom && rect.left <= e.clientX && e.clientX <= rect.right;
    if(!inDialog) $("details").close();
  });

  // default compact on phones
  setCompact(window.matchMedia("(max-width: 640px)").matches);

  await loadDataset(state.datasets[0]?.slug);
}
init();
