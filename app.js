/* ===================== আরহাম জেনারেল স্টোর — shared app logic ===================== */

const CATEGORIES = [
  "Cigarettes & Tobacco",
  "Cold Drinks & Beverages",
  "Ice Cream & Frozen",
  "Chocolates & Confectionery",
  "Biscuits & Bakery",
  "Snacks & Chips",
  "Rice, Dal & Grains",
  "Cooking Essentials",
  "Tea & Coffee",
  "Dairy & Eggs",
  "Noodles & Instant Food",
  "Canned & Packaged Food",
  "Personal Care",
  "Household & Cleaning",
  "Baby Products",
  "Stationery & Miscellaneous",
];

/* ---------- Theme ---------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = t === "dark" ? "☀️" : "🌙";
  localStorage.setItem("theme", t);
}
function toggleTheme() {
  applyTheme(
    document.documentElement.dataset.theme === "dark" ? "light" : "dark",
  );
}
applyTheme(
  localStorage.getItem("theme") ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
);

/* ---------- Date helpers ---------- */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function formatShortDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

/* ---------- Toast ---------- */
let toastTimer;
function showToast(msg, isWarn) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.toggle("warn", !!isWarn);
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- Cloud config (shared across every page via localStorage) ---------- */
function getCloudConfig() {
  return {
    url: localStorage.getItem("sbUrl") || "",
    key: localStorage.getItem("sbKey") || "",
  };
}
function isCloudConfigured() {
  const c = getCloudConfig();
  return !!(c.url && c.key);
}
function updateSyncDot(state) {
  const dot = document.getElementById("syncDot");
  const label = document.getElementById("syncLabel");
  if (!dot || !label) return;
  dot.classList.remove("synced", "error");
  if (state === "ok") {
    dot.classList.add("synced");
    label.textContent = "Cloud synced";
  } else if (state === "error") {
    dot.classList.add("error");
    label.textContent = "Cloud error — using local";
  } else {
    label.textContent = "Local only";
  }
}

function openSettings() {
  const c = getCloudConfig();
  document.getElementById("sbUrl").value = c.url;
  document.getElementById("sbKey").value = c.key;
  document.getElementById("sbStatus").className = "statusLine";
  document.getElementById("sbStatus").textContent = "";
  document.getElementById("settingsModal").classList.add("show");
}
function closeSettings() {
  document.getElementById("settingsModal").classList.remove("show");
}
async function saveCloudSettings() {
  const url = "https://tbboptkqgegrlugmcpgx.supabase.co";
  // const url = document.getElementById("sbUrl").value.trim().replace(/\/+$/, "");
  const key =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiYm9wdGtxZ2Vncmx1Z21jcGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTA5MjUsImV4cCI6MjEwNDA2NjkyNX0.w5fcAg0J9dHeHq6AhrYe90Jn9Np7zhENp3WztexP7b8";
  // const key = document.getElementById("sbKey").value.trim();
  const statusEl = document.getElementById("sbStatus");

  if (!url || !key) {
    statusEl.className = "statusLine bad";
    statusEl.textContent =
      "Please enter both the Project URL and the anon key.";
    return;
  }

  statusEl.className = "statusLine";
  statusEl.textContent = "";

  localStorage.setItem("sbUrl", url);
  localStorage.setItem("sbKey", key);

  try {
    const res = await fetch(`${url}/rest/v1/sales_entries?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    statusEl.className = "statusLine ok";
    statusEl.textContent = "Connected! Cloud sync is on.";
    updateSyncDot("ok");
    setTimeout(() => {
      closeSettings();
      if (typeof onCloudReconnect === "function") onCloudReconnect();
    }, 900);
  } catch (err) {
    statusEl.className = "statusLine bad";
    statusEl.textContent =
      "Couldn't reach that table (" +
      err.message +
      "). Check the URL/key, and make sure you ran the table-creation SQL in Supabase.";
    updateSyncDot("error");
  }
}
function disconnectCloud() {
  localStorage.removeItem("sbUrl");
  localStorage.removeItem("sbKey");
  updateSyncDot("off");
  closeSettings();
  if (typeof onCloudReconnect === "function") onCloudReconnect();
  showToast("Disconnected — back to local only");
}

/* ---------- Generic Supabase REST helpers (table name passed in) ---------- */
async function cloudFetch(table, orderBy) {
  const { url, key } = getCloudConfig();
  const order = orderBy ? `&order=${orderBy}` : "";
  const res = await fetch(`${url}/rest/v1/${table}?select=*${order}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
async function cloudUpsert(table, row) {
  const { url, key } = getCloudConfig();
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([row]),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
}
async function cloudDelete(table, id) {
  const { url, key } = getCloudConfig();
  const res = await fetch(
    `${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    },
  );
  if (!res.ok) throw new Error("HTTP " + res.status);
}

/* Sum the "total" column of an item-entry table (sales_entries / purchase_entries)
   for one date — used by Day End to auto-pull that day's Sales and Purchase. */
async function sumEntriesForDate(storeKey, table, iso) {
  if (isCloudConfigured()) {
    try {
      const { url, key } = getCloudConfig();
      const res = await fetch(
        `${url}/rest/v1/${table}?select=total&entry_date=eq.${iso}`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rows = await res.json();
      updateSyncDot("ok");
      return rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
    } catch (err) {
      updateSyncDot("error");
      // fall through to local cache below
    }
  }
  const entries = loadLocal(storeKey);
  return entries
    .filter((e) => e.date === iso)
    .reduce((s, e) => s + (Number(e.total) || 0), 0);
}

/* ---------- Local storage helpers ---------- */
function loadLocal(storeKey) {
  try {
    return JSON.parse(localStorage.getItem(storeKey)) || [];
  } catch (e) {
    return [];
  }
}
function saveLocal(storeKey, list) {
  localStorage.setItem(storeKey, JSON.stringify(list));
}

/* ---------- Item-entry DB mapping (Sales / Purchase share this shape) ---------- */
function toDBEntry(e) {
  return {
    id: e.id,
    entry_date: e.date,
    entry_time: e.time,
    total: e.total,
    items: e.items,
  };
}
function fromDBEntry(row) {
  return {
    id: row.id,
    date: row.entry_date,
    time: row.entry_time,
    total: Number(row.total),
    items: row.items || [],
  };
}

/* ---------- Nav highlighting ---------- */
function highlightNav() {
  const page = document.body.dataset.page;
  const group = document.body.dataset.navgroup;
  document.querySelectorAll("[data-navgroup]").forEach((el) => {
    el.classList.toggle(
      "active",
      el.dataset.navgroup === group && el.tagName === "A",
    );
  });
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.classList.toggle("active", el.dataset.nav === page);
  });
  ["sales", "purchase", "days"].forEach((g) => {
    const sub = document.getElementById("subNav-" + g);
    if (sub) sub.style.display = group === g ? "flex" : "none";
  });
}
document.addEventListener("DOMContentLoaded", highlightNav);
