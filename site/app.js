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

  /* ---------- End dimension backdrop ---------- */
  function drawEnd() {
    const c = $("endbg"); if (!c) return;
    const H = 180, W = Math.max(200, Math.round(H * innerWidth / Math.max(1, innerHeight)));
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < H; y++) { const t = y / H; x.fillStyle = `rgb(${Math.round(10 + 16 * t)},${Math.round(5 + 9 * t)},${Math.round(20 + 28 * t)})`; x.fillRect(0, y, W, 1); }
    for (let i = 0; i < 7; i++) {
      const cx = r() * W, cy = r() * H * 0.7, rad = 25 + r() * 45;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, "rgba(130,70,210,0.20)"); g.addColorStop(1, "rgba(130,70,210,0)");
      x.fillStyle = g; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < W * 0.7; i++) { x.fillStyle = `rgba(232,222,255,${(0.2 + r() * 0.6).toFixed(2)})`; x.fillRect(Math.floor(r() * W), Math.floor(r() * H * 0.85), 1, 1); }

    const island = (cx, cy, w) => {
      cx = Math.round(cx); cy = Math.round(cy); w = Math.max(3, Math.round(w));
      for (let i = -w; i <= w; i++) {
        const e = 1 - (i / w) * (i / w);
        const depth = Math.max(1, Math.round(e * w * 0.75 + (r() - 0.5) * 2));
        const lift = Math.round((1 - e) * 2);
        for (let d = 0; d < depth; d++) {
          let col = d < 2 ? "#e6e3ab" : (r() < 0.18 ? "#a9a66c" : "#cbc88c");
          if (d > depth * 0.6) col = r() < 0.4 ? "#8f8c58" : "#b0ad72";
          x.fillStyle = col; x.fillRect(cx + i, cy + lift + d, 1, 1);
        }
      }
    };
    const pillar = (px, baseY, h) => {
      px = Math.round(px);
      x.fillStyle = "#120c1e"; x.fillRect(px - 2, baseY - h, 5, h);
      x.fillStyle = "#2c1f45"; x.fillRect(px - 2, baseY - h, 1, h);
      x.fillStyle = "#3a2a5c"; for (let k = 0; k < h; k += 3) x.fillRect(px + 1, baseY - h + k, 1, 1);
      const cy = baseY - h - 3;
      const g = x.createRadialGradient(px + 0.5, cy, 0, px + 0.5, cy, 9);
      g.addColorStop(0, "rgba(255,150,230,0.55)"); g.addColorStop(1, "rgba(255,150,230,0)");
      x.fillStyle = g; x.fillRect(px - 9, cy - 9, 19, 19);
      x.fillStyle = "#ff9be6"; x.fillRect(px - 1, cy - 1, 3, 3);
      x.fillStyle = "#fff0fb"; x.fillRect(px, cy, 1, 1);
    };

    // far islands, then fade them into the void
    for (let i = 0; i < Math.max(4, Math.round(W / 70)); i++) island(r() * W, H * (0.25 + r() * 0.3), 4 + r() * 8);
    x.fillStyle = "rgba(14,8,28,0.45)"; x.fillRect(0, 0, W, H);
    // mid islands
    island(W * 0.12, H * 0.58, 12 + r() * 6);
    island(W * 0.88, H * 0.52, 10 + r() * 6);
    // main island with obsidian pillars
    const mw = Math.min(W * 0.3, 120), my = H * 0.76;
    island(W * 0.5, my, mw);
    const n = 5;
    for (let k = 0; k < n; k++) {
      const px = W * 0.5 - mw * 0.75 + (k / (n - 1)) * mw * 1.5;
      pillar(px, my + 1, 18 + Math.round(r() * 26));
    }
    // a few drifting end particles
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(190,120,255,${(0.25 + r() * 0.4).toFixed(2)})`; x.fillRect(Math.floor(r() * W), Math.floor(r() * H), 1, 1); }
    // dim slightly so text stays readable
    x.fillStyle = "rgba(15,11,26,0.18)"; x.fillRect(0, 0, W, H);
  }
  drawEnd();
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(drawEnd, 200); });

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
