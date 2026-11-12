(function () {
  const CFG = window.NOMADCRAFT || {};
  const ADDR = (CFG.serverAddress || "").trim();
  const $ = (id) => document.getElementById(id);

  const STATS = [
    { key: "playtime_hours", label: "Playtime", unit: "hrs", digits: 1 },
    { key: "diamonds", label: "Diamonds mined", unit: "" },
    { key: "mob_kills", label: "Mob kills", unit: "" },
    { key: "player_kills", label: "Player kills", unit: "" },
    { key: "deaths", label: "Deaths", unit: "" },
    { key: "advancements", label: "Advancements", unit: "" },
    { key: "distance_km", label: "Distance", unit: "km", digits: 1 }
  ];
  let current = "playtime_hours";
  let players = [];
  try { const s = localStorage.getItem("nc_tab"); if (STATS.some((x) => x.key === s)) current = s; } catch (e) {}

  /* ---------- logo: use assets/logo.png if it exists ---------- */
  const logo = $("logoImg");
  logo.addEventListener("load", () => { logo.hidden = false; $("logoText").hidden = true; });
  if (logo.complete && logo.naturalWidth) { logo.hidden = false; $("logoText").hidden = true; }

  /* ---------- pixel banner ---------- */
  (function drawScene() {
    const c = $("scene"), W = 160, H = 64; c.width = W; c.height = H;
    const x = c.getContext("2d");
    let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < H; y++) { const t = y / H; x.fillStyle = `rgb(${Math.round(30 + 60 * t)},${Math.round(16 + 20 * t)},${Math.round(60 + 50 * t)})`; x.fillRect(0, y, W, 1); }
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,255,255,${(0.3 + r() * 0.6).toFixed(2)})`; x.fillRect(Math.floor(r() * W), Math.floor(r() * H * 0.55), 1, 1); }
    x.fillStyle = "#efe3ff"; x.fillRect(122, 8, 8, 8); x.fillStyle = "#d6c4f2"; x.fillRect(124, 10, 2, 2); x.fillRect(127, 13, 2, 1);
    const layer = (base, amp, freq, col, ph) => { x.fillStyle = col; for (let i = 0; i < W; i += 2) { const h = Math.round(base + Math.sin(i * freq + ph) * amp + Math.sin(i * freq * 2.3 + ph) * amp * 0.4); x.fillRect(i, h, 2, H - h); } };
    layer(38, 5, 0.05, "#3b2470", 1); layer(44, 4, 0.08, "#2b1a52", 3); layer(52, 3, 0.11, "#1d1238", 5);
    x.fillStyle = "#140c26"; x.fillRect(18, 34, 12, 16); x.fillStyle = "#7b3cff"; x.fillRect(20, 36, 8, 12);
    x.fillStyle = "#b48bff"; for (let i = 0; i < 6; i++) x.fillRect(20 + Math.floor(r() * 8), 36 + Math.floor(r() * 12), 1, 1);
  })();

  /* ---------- header bits ---------- */
  $("ipText").textContent = ADDR || "IP not set";
  $("copyIp").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(ADDR); $("copyIp").textContent = "Copied!"; }
    catch (e) { const r = document.createRange(); r.selectNodeContents($("ipText")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $("copyIp").textContent = "Press Ctrl+C"; }
    setTimeout(() => ($("copyIp").textContent = "Copy IP"), 2000);
  });
  if (CFG.discordInvite) { $("discordLink").href = CFG.discordInvite; $("discordLink").hidden = false; }

  const head = (name, size) => {
    const img = document.createElement("img");
    img.alt = ""; img.loading = "lazy"; img.width = size; img.height = size;
    img.src = "https://mc-heads.net/avatar/" + encodeURIComponent(name) + "/" + size;
    img.onerror = () => img.removeAttribute("src");
    return img;
  };
  const note = (el, text) => { el.textContent = ""; const s = document.createElement("span"); s.className = "note"; s.textContent = text; el.appendChild(s); };

  /* ---------- live status (mcsrvstat.us) ---------- */
  async function refreshStatus() {
    const tiles = $("tiles"), heads = $("heads");
    if (!ADDR || ADDR === "YOUR.SERVER.IP") {
      $("tStatus").textContent = "Not set up"; $("tUpdated").textContent = "Add your IP in config.js";
      note(heads, "Add your server address to config.js to show who's online."); return;
    }
    try {
      const res = await fetch("https://api.mcsrvstat.us/3/" + encodeURIComponent(ADDR), { cache: "no-store" });
      const d = await res.json();
      const on = !!d.online;
      tiles.dataset.state = on ? "on" : "off";
      $("tStatus").textContent = on ? "Online" : "Offline";
      $("tUpdated").textContent = "Checked " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const count = on && d.players ? d.players.online || 0 : 0;
      const max = on && d.players ? d.players.max || 0 : 0;
      $("tCount").textContent = String(count);
      if (max) { const sm = document.createElement("small"); sm.style.cssText = "font-size:14px;color:var(--muted)"; sm.textContent = "/ " + max; $("tCount").appendChild(sm); }
      $("tMeter").style.width = max ? Math.min(100, (count / max) * 100) + "%" : "0";
      $("tVersion").textContent = on && d.version ? String(d.version).replace(/^.*?(\d+\.\d+(\.\d+)?).*$/, "$1") : "–";
      $("motd").textContent = on && d.motd && d.motd.clean ? d.motd.clean.join(" ").trim() : "";

      heads.textContent = "";
      const list = on && d.players && Array.isArray(d.players.list) ? d.players.list : [];
      if (!on) note(heads, "The server is offline right now.");
      else if (!count) note(heads, "Nobody's on right now.");
      else if (!list.length) note(heads, count + " playing. Turn on enable-query in server.properties to show their names.");
      else list.forEach((p) => { const el = document.createElement("div"); el.className = "head"; el.appendChild(head(p.name, 22)); el.append(p.name); heads.appendChild(el); });
    } catch (e) {
      $("tStatus").textContent = "Unknown"; $("tUpdated").textContent = "Couldn't reach the status service";
      note(heads, "Couldn't check the server right now. Trying again in a minute.");
    }
  }

  /* ---------- leaderboard (data/leaderboard.json, built by GitHub Actions) ---------- */
  function renderTabs() {
    const t = $("tabs"); t.textContent = "";
    STATS.forEach((s) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = s.label; b.setAttribute("aria-pressed", s.key === current);
      b.onclick = () => { current = s.key; try { localStorage.setItem("nc_tab", current); } catch (e) {} renderTabs(); renderBoard(); };
      t.appendChild(b);
    });
  }
  function renderBoard() {
    const b = $("board"); b.textContent = "";
    const stat = STATS.find((s) => s.key === current);
    const list = players.slice().sort((a, c) => (Number(c[current]) || 0) - (Number(a[current]) || 0));
    if (!list.length) { b.innerHTML = '<div class="empty"><strong>No stats yet</strong>The leaderboard fills in once the server has been played on and the site has synced.</div>'; return; }
    const max = Math.max(1, ...list.map((p) => Number(p[current]) || 0));
    list.forEach((p, i) => {
      const v = Number(p[current]) || 0;
      const r = document.createElement("div"); r.className = "row r" + (i + 1);
      const rk = document.createElement("div"); rk.className = "rank"; rk.textContent = i + 1;
      const who = document.createElement("div"); who.className = "who"; who.appendChild(head(p.name, 32));
      const n = document.createElement("span"); n.textContent = p.name; who.appendChild(n);
      const val = document.createElement("div"); val.className = "val";
      val.textContent = v.toLocaleString(undefined, { maximumFractionDigits: stat.digits || 0 });
      if (stat.unit) { const u = document.createElement("small"); u.textContent = stat.unit; val.appendChild(u); }
      const bar = document.createElement("div"); bar.className = "bar"; const bi = document.createElement("i"); bi.style.width = (v / max) * 100 + "%"; bar.appendChild(bi);
      r.append(rk, who, val, bar); b.appendChild(r);
    });
  }
  async function loadLeaderboard() {
    try {
      const res = await fetch("data/leaderboard.json?t=" + Date.now());
      const d = await res.json();
      players = Array.isArray(d.players) ? d.players : [];
      $("lbUpdated").textContent = d.updated ? "Stats last synced " + new Date(d.updated).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + ". Syncs about every 30 minutes." : "";
    } catch (e) { players = []; }
    renderBoard();
  }

  renderTabs();
  refreshStatus();
  loadLeaderboard();
  setInterval(refreshStatus, Math.max(30, CFG.refreshSeconds || 60) * 1000);
  setInterval(loadLeaderboard, 5 * 60 * 1000);
})();
