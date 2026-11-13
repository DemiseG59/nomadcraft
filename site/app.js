(function () {
  const CFG = window.NOMADCRAFT || {};
  const ADDR = (CFG.serverAddress || "").trim();
  const $ = (id) => document.getElementById(id);

  const STATS = [
    { key: "xp", label: "Nomad XP", unit: "XP" },
    { key: "playtime_hours", label: "Playtime", unit: "hrs", digits: 1 },
    { key: "diamonds", label: "Diamonds mined", unit: "" },
    { key: "mob_kills", label: "Mob kills", unit: "" },
    { key: "player_kills", label: "Player kills", unit: "" },
    { key: "deaths", label: "Deaths", unit: "" },
    { key: "blocks_placed", label: "Blocks placed", unit: "" },
    { key: "blocks_mined", label: "Blocks mined", unit: "" },
    { key: "villager_trades", label: "Villager trades", unit: "" },
    { key: "elytra_km", label: "Elytra distance", unit: "km", digits: 1 },
    { key: "fish_caught", label: "Fish caught", unit: "" },
    { key: "items_crafted", label: "Items crafted", unit: "" },
    { key: "advancements", label: "Advancements", unit: "" },
    { key: "distance_km", label: "Distance", unit: "km", digits: 1 }
  ];
  let current = "xp";
  let players = [];
  let autoTimeline = [];
  let manualEvents = [];
  let ADV = {};
  try { const s = localStorage.getItem("nc_tab"); if (STATS.some((x) => x.key === s)) current = s; } catch (e) {}

  const fmt = (v, digits) => (Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: digits || 0 });
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /* ---------- logo: use assets/logo.png if it exists ---------- */
  const logo = $("logoImg");
  logo.addEventListener("load", () => { logo.hidden = false; $("logoText").hidden = true; });
  if (logo.complete && logo.naturalWidth) { logo.hidden = false; $("logoText").hidden = true; }

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
  const note = (box, text) => { box.textContent = ""; box.appendChild(el("span", "note", text)); };

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
      if (max) { const sm = el("small", null, "/ " + max); sm.style.cssText = "font-size:14px;color:var(--muted)"; $("tCount").appendChild(sm); }
      $("tMeter").style.width = max ? Math.min(100, (count / max) * 100) + "%" : "0";
      $("tVersion").textContent = on && d.version ? String(d.version).replace(/^.*?(\d+\.\d+(\.\d+)?).*$/, "$1") : "–";
      $("motd").textContent = on && d.motd && d.motd.clean ? d.motd.clean.join(" ").trim() : "";

      heads.textContent = "";
      const list = on && d.players && Array.isArray(d.players.list) ? d.players.list : [];
      if (!on) note(heads, "The server is offline right now.");
      else if (!count) note(heads, "Nobody's on right now.");
      else if (!list.length) note(heads, count + " playing.");
      else list.forEach((p) => {
        const b = el("button", "head"); b.type = "button";
        b.appendChild(head(p.name, 22)); b.append(p.name);
        b.onclick = () => openProfileByName(p.name);
        heads.appendChild(b);
      });
    } catch (e) {
      $("tStatus").textContent = "Unknown"; $("tUpdated").textContent = "Couldn't reach the status service";
      note(heads, "Couldn't check the server right now. Trying again in a minute.");
    }
  }

  /* ---------- leaderboard ---------- */
  function renderTabs() {
    const t = $("tabs"); t.textContent = "";
    STATS.forEach((s) => {
      const b = el("button", null, s.label); b.type = "button"; b.setAttribute("aria-pressed", s.key === current);
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
      const r = el("button", "row r" + (i + 1)); r.type = "button";
      r.setAttribute("aria-label", "Open " + p.name + "'s profile");
      r.appendChild(el("div", "rank", String(i + 1)));
      const who = el("div", "who"); who.appendChild(head(p.name, 32)); who.appendChild(el("span", null, p.name));
      if (p.level != null) who.appendChild(el("em", "rank-chip", "Lv " + p.level + " " + p.rank));
      const val = el("div", "val", fmt(v, stat.digits)); if (stat.unit) val.appendChild(el("small", null, stat.unit));
      const bar = el("div", "bar"); const bi = el("i"); bi.style.width = (v / max) * 100 + "%"; bar.appendChild(bi);
      r.append(who, val, bar);
      r.onclick = () => openProfile(p);
      b.appendChild(r);
    });
  }

  /* ---------- Hall of Fame ---------- */
  const RECORDS = [
    { key: "xp", title: "Highest rank", unit: "XP" },
    { key: "playtime_hours", title: "Most dedicated", unit: "hrs played", digits: 1 },
    { key: "diamonds", title: "Top diamond miner", unit: "diamond ores" },
    { key: "mob_kills", title: "Mob slayer", unit: "mobs killed" },
    { key: "since_death_hours", title: "Longest without dying", unit: "hrs alive", digits: 1 },
    { key: "deaths", title: "Most deaths", unit: "deaths" },
    { key: "blocks_placed", title: "Master builder", unit: "blocks placed" },
    { key: "elytra_km", title: "Sky pilot", unit: "km flown", digits: 1 },
    { key: "villager_trades", title: "Top trader", unit: "trades" }
  ];
  function renderHall() {
    const box = $("hof"); box.textContent = "";
    if (!players.length) { box.innerHTML = '<div class="empty"><strong>No records yet</strong>Records appear once the stats sync.</div>'; return; }
    RECORDS.forEach((rec) => {
      const top = players.slice().sort((a, b) => (Number(b[rec.key]) || 0) - (Number(a[rec.key]) || 0))[0];
      if (!top || !(Number(top[rec.key]) > 0)) return;
      const card = el("button", "rec"); card.type = "button";
      card.appendChild(el("div", "eyebrow", rec.title));
      const who = el("div", "rec-who"); who.appendChild(head(top.name, 40)); who.appendChild(el("span", null, top.name));
      card.appendChild(who);
      const v = el("div", "rec-val", fmt(top[rec.key], rec.digits)); v.appendChild(el("small", null, " " + rec.unit));
      card.appendChild(v);
      card.onclick = () => openProfile(top);
      box.appendChild(card);
    });
  }

  /* ---------- Timeline ---------- */
  function renderTimeline() {
    const ol = $("tl"); ol.textContent = "";
    const items = autoTimeline.map((e) => ({ date: e.date, title: e.title, text: e.player ? "by " + e.player : "", player: e.player }))
      .concat(manualEvents.map((e) => ({ date: e.date, title: e.title, text: e.text || "" })))
      .filter((e) => e.date && e.title)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (!items.length) { const li = el("li", "empty"); li.innerHTML = "<strong>Nothing yet</strong>Big moments show up here as players reach them."; ol.appendChild(li); return; }
    items.forEach((e) => {
      const li = el("li", "tl-item");
      li.appendChild(el("time", "tl-date", new Date(e.date).toLocaleDateString([], { month: "short", day: "numeric" })));
      const body = el("div", "tl-body");
      body.appendChild(el("strong", null, e.title));
      if (e.player) { const who = el("span", "tl-who"); who.appendChild(head(e.player, 18)); who.append(e.player); body.appendChild(who); }
      else if (e.text) body.appendChild(el("span", "tl-who", e.text));
      li.appendChild(body);
      ol.appendChild(li);
    });
  }

  /* ---------- Player profile ---------- */
  const PROFILE_STATS = [
    ["playtime_hours", "Playtime", "hrs", 1], ["deaths", "Deaths", "", 0], ["since_death_hours", "Since last death", "hrs", 1],
    ["mob_kills", "Mob kills", "", 0], ["player_kills", "Player kills", "", 0], ["diamonds", "Diamond ores", "", 0],
    ["blocks_mined", "Blocks mined", "", 0], ["blocks_placed", "Blocks placed", "", 0], ["items_crafted", "Items crafted", "", 0],
    ["villager_trades", "Villager trades", "", 0], ["fish_caught", "Fish caught", "", 0], ["jumps", "Jumps", "", 0],
    ["distance_km", "Distance", "km", 1], ["elytra_km", "Elytra", "km", 1], ["advancements", "Advancements", "", 0]
  ];
  function openProfileByName(name) {
    const p = players.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
    if (p) openProfile(p);
  }
  function openProfile(p) {
    const box = $("pf"); box.textContent = "";
    const top = el("div", "pf-top"); top.appendChild(head(p.name, 72));
    const tt = el("div"); const h = el("h3", null, p.name); h.id = "pfName"; tt.appendChild(h);
    if (p.fav_mob) tt.appendChild(el("div", "pf-sub", "Favorite mob to kill: " + p.fav_mob.name + " (" + fmt(p.fav_mob.count) + ")"));
    top.appendChild(tt); box.appendChild(top);

    if (p.level != null) {
      const rk = el("div", "pf-rank");
      const span = Math.max(1, p.next_xp - p.lvl_xp);
      const pct = Math.min(100, Math.max(0, ((p.xp - p.lvl_xp) / span) * 100));
      const row = el("div", "pf-rank-row");
      row.appendChild(el("strong", null, "Level " + p.level + " · " + p.rank));
      row.appendChild(el("span", null, fmt(p.xp) + " XP"));
      rk.appendChild(row);
      const bar = el("div", "xpbar"); const fill = el("i"); fill.style.width = pct + "%"; bar.appendChild(fill); rk.appendChild(bar);
      let sub = fmt(p.next_xp - p.xp) + " XP to Level " + (p.level + 1);
      const wk = window.NC && NC.weekGain ? NC.weekGain(p.name) : null;
      if (wk && wk.xp > 0) sub += " · +" + fmt(wk.xp) + " XP this week";
      rk.appendChild(el("div", "pf-sub", sub));
      box.appendChild(rk);
    }

    if (window.NC && NC.badgesFor) {
      const b = NC.badgesFor(p);
      const bw = el("div", "pf-badges");
      bw.appendChild(el("div", "eyebrow", "Badges · " + b.earned.length + " of " + b.total));
      const chips = el("div", "chips");
      if (!b.earned.length) chips.appendChild(el("span", "note", "No badges yet"));
      b.earned.forEach((x) => chips.appendChild(NC.badgeChip(x)));
      bw.appendChild(chips);
      if (b.next.length) {
        bw.appendChild(el("div", "eyebrow pf-next", "Almost there"));
        const ul = el("ul", "next-list");
        b.next.forEach((x) => {
          const li = el("li");
          const top2 = el("div", "next-top"); top2.appendChild(el("strong", null, x.name)); top2.appendChild(el("span", null, x.progressText)); li.appendChild(top2);
          const bar = el("div", "xpbar small"); const f = el("i"); f.style.width = Math.round(x.ratio * 100) + "%"; bar.appendChild(f); li.appendChild(bar);
          li.appendChild(el("span", "next-desc", x.desc));
          ul.appendChild(li);
        });
        bw.appendChild(ul);
      }
      box.appendChild(bw);
    }

    const grid = el("div", "pf-grid");
    PROFILE_STATS.forEach(([k, label, unit, digits]) => {
      const c = el("div", "pf-stat");
      c.appendChild(el("div", "eyebrow", label));
      const v = el("div", "pf-v", fmt(p[k], digits)); if (unit) v.appendChild(el("small", null, " " + unit));
      c.appendChild(v); grid.appendChild(c);
    });
    box.appendChild(grid);

    const lists = el("div", "pf-lists");
    const mk = (title, arr) => {
      const w = el("div"); w.appendChild(el("div", "eyebrow", title));
      const ul = el("ul", "pf-list");
      if (!arr || !arr.length) ul.appendChild(el("li", "note", "None yet"));
      (arr || []).forEach((x) => { const li = el("li"); li.appendChild(el("span", null, x.name)); li.appendChild(el("b", null, fmt(x.count))); ul.appendChild(li); });
      w.appendChild(ul); return w;
    };
    lists.appendChild(mk("Most killed", p.top_kills));
    lists.appendChild(mk("Killed by", p.killed_by));
    box.appendChild(lists);

    const adv = p.adv_list || [];
    const have = new Set(adv.map((a) => a.id));
    const total = Object.keys(ADV).length;
    const aw = el("div", "pf-adv");
    aw.appendChild(el("div", "eyebrow", "Advancements unlocked · " + adv.length + (total ? " of " + total : "")));
    const chips = el("div", "chips");
    if (!adv.length) chips.appendChild(el("span", "note", "None yet"));
    adv.forEach((a) => {
      const info = ADV[a.id];
      const c = el("span", "chip", info ? info.title : a.title);
      c.title = (info ? info.how + " " : "") + (a.time ? "Unlocked " + new Date(a.time).toLocaleDateString() : "");
      chips.appendChild(c);
    });
    aw.appendChild(chips); box.appendChild(aw);

    const locked = Object.entries(ADV).filter(([id]) => !have.has(id));
    if (locked.length) {
      const det = el("details", "pf-locked");
      det.appendChild(el("summary", null, "Still to unlock · " + locked.length + " (how to get them)"));
      const CATS = { story: "Minecraft", nether: "Nether", end: "The End", adventure: "Adventure", husbandry: "Husbandry" };
      Object.keys(CATS).forEach((cat) => {
        const items = locked.filter(([, v]) => v.cat === cat);
        if (!items.length) return;
        det.appendChild(el("div", "eyebrow lk-cat", CATS[cat] + " · " + items.length));
        const ul = el("ul", "lk-list");
        items.forEach(([, v]) => { const li = el("li"); li.appendChild(el("strong", null, v.title)); li.appendChild(el("span", null, v.how)); ul.appendChild(li); });
        det.appendChild(ul);
      });
      box.appendChild(det);
    }

    const dlg = $("profile");
    if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
    try { history.replaceState(null, "", "#player-" + encodeURIComponent(p.name)); } catch (e) {}
  }
  function closeProfile() {
    const dlg = $("profile"); if (dlg.open) dlg.close ? dlg.close() : dlg.removeAttribute("open");
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }
  $("pfClose").onclick = closeProfile;
  $("profile").addEventListener("click", (e) => { if (e.target === $("profile")) closeProfile(); });
  $("profile").addEventListener("close", () => { try { if (location.hash.startsWith("#player-")) history.replaceState(null, "", location.pathname + location.search); } catch (e) {} });

  /* ---------- data loading ---------- */
  async function loadLeaderboard() {
    try {
      const res = await fetch("data/leaderboard.json?t=" + Date.now());
      const d = await res.json();
      players = Array.isArray(d.players) ? d.players : [];
      autoTimeline = Array.isArray(d.timeline) ? d.timeline : [];
      $("lbUpdated").textContent = d.updated ? "Stats last synced " + new Date(d.updated).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + ". Syncs about every 30 minutes." : "";
    } catch (e) { players = []; }
    try { const r = await fetch("data/events.json?t=" + Date.now()); const ev = await r.json(); manualEvents = Array.isArray(ev) ? ev : []; } catch (e) { manualEvents = []; }
    if (!Object.keys(ADV).length) { try { const r = await fetch("data/advancements.json"); ADV = (await r.json()) || {}; } catch (e) { ADV = {}; } }
    renderBoard(); renderHall(); renderTimeline();
    try { document.dispatchEvent(new CustomEvent("nc:data", { detail: { players: players } })); } catch (e) {}
    const m = location.hash.match(/^#player-(.+)$/);
    if (m && !$("profile").open) openProfileByName(decodeURIComponent(m[1]));
  }

  window.NC = window.NC || {};
  NC.openProfileByName = openProfileByName;
  NC.openProfile = openProfile;

  renderTabs();
  refreshStatus();
  loadLeaderboard();
  setInterval(refreshStatus, Math.max(30, CFG.refreshSeconds || 60) * 1000);
  setInterval(loadLeaderboard, 5 * 60 * 1000);
})();
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
    { key: "blocks_placed", label: "Blocks placed", unit: "" },
    { key: "blocks_mined", label: "Blocks mined", unit: "" },
    { key: "villager_trades", label: "Villager trades", unit: "" },
    { key: "elytra_km", label: "Elytra distance", unit: "km", digits: 1 },
    { key: "fish_caught", label: "Fish caught", unit: "" },
    { key: "items_crafted", label: "Items crafted", unit: "" },
    { key: "advancements", label: "Advancements", unit: "" },
    { key: "distance_km", label: "Distance", unit: "km", digits: 1 }
  ];
  let current = "playtime_hours";
  let players = [];
  let autoTimeline = [];
  let manualEvents = [];
  let ADV = {};
  try { const s = localStorage.getItem("nc_tab"); if (STATS.some((x) => x.key === s)) current = s; } catch (e) {}

  const fmt = (v, digits) => (Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: digits || 0 });
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /* ---------- logo: use assets/logo.png if it exists ---------- */
  const logo = $("logoImg");
  logo.addEventListener("load", () => { logo.hidden = false; $("logoText").hidden = true; });
  if (logo.complete && logo.naturalWidth) { logo.hidden = false; $("logoText").hidden = true; }

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
  const note = (box, text) => { box.textContent = ""; box.appendChild(el("span", "note", text)); };

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
      if (max) { const sm = el("small", null, "/ " + max); sm.style.cssText = "font-size:14px;color:var(--muted)"; $("tCount").appendChild(sm); }
      $("tMeter").style.width = max ? Math.min(100, (count / max) * 100) + "%" : "0";
      $("tVersion").textContent = on && d.version ? String(d.version).replace(/^.*?(\d+\.\d+(\.\d+)?).*$/, "$1") : "–";
      $("motd").textContent = on && d.motd && d.motd.clean ? d.motd.clean.join(" ").trim() : "";

      heads.textContent = "";
      const list = on && d.players && Array.isArray(d.players.list) ? d.players.list : [];
      if (!on) note(heads, "The server is offline right now.");
      else if (!count) note(heads, "Nobody's on right now.");
      else if (!list.length) note(heads, count + " playing.");
      else list.forEach((p) => {
        const b = el("button", "head"); b.type = "button";
        b.appendChild(head(p.name, 22)); b.append(p.name);
        b.onclick = () => openProfileByName(p.name);
        heads.appendChild(b);
      });
    } catch (e) {
      $("tStatus").textContent = "Unknown"; $("tUpdated").textContent = "Couldn't reach the status service";
      note(heads, "Couldn't check the server right now. Trying again in a minute.");
    }
  }

  /* ---------- leaderboard ---------- */
  function renderTabs() {
    const t = $("tabs"); t.textContent = "";
    STATS.forEach((s) => {
      const b = el("button", null, s.label); b.type = "button"; b.setAttribute("aria-pressed", s.key === current);
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
      const r = el("button", "row r" + (i + 1)); r.type = "button";
      r.setAttribute("aria-label", "Open " + p.name + "'s profile");
      r.appendChild(el("div", "rank", String(i + 1)));
      const who = el("div", "who"); who.appendChild(head(p.name, 32)); who.appendChild(el("span", null, p.name));
      const val = el("div", "val", fmt(v, stat.digits)); if (stat.unit) val.appendChild(el("small", null, stat.unit));
      const bar = el("div", "bar"); const bi = el("i"); bi.style.width = (v / max) * 100 + "%"; bar.appendChild(bi);
      r.append(who, val, bar);
      r.onclick = () => openProfile(p);
      b.appendChild(r);
    });
  }

  /* ---------- Hall of Fame ---------- */
  const RECORDS = [
    { key: "playtime_hours", title: "Most dedicated", unit: "hrs played", digits: 1 },
    { key: "diamonds", title: "Top diamond miner", unit: "diamond ores" },
    { key: "mob_kills", title: "Mob slayer", unit: "mobs killed" },
    { key: "since_death_hours", title: "Longest without dying", unit: "hrs alive", digits: 1 },
    { key: "deaths", title: "Most deaths", unit: "deaths" },
    { key: "blocks_placed", title: "Master builder", unit: "blocks placed" },
    { key: "elytra_km", title: "Sky pilot", unit: "km flown", digits: 1 },
    { key: "villager_trades", title: "Top trader", unit: "trades" }
  ];
  function renderHall() {
    const box = $("hof"); box.textContent = "";
    if (!players.length) { box.innerHTML = '<div class="empty"><strong>No records yet</strong>Records appear once the stats sync.</div>'; return; }
    RECORDS.forEach((rec) => {
      const top = players.slice().sort((a, b) => (Number(b[rec.key]) || 0) - (Number(a[rec.key]) || 0))[0];
      if (!top || !(Number(top[rec.key]) > 0)) return;
      const card = el("button", "rec"); card.type = "button";
      card.appendChild(el("div", "eyebrow", rec.title));
      const who = el("div", "rec-who"); who.appendChild(head(top.name, 40)); who.appendChild(el("span", null, top.name));
      card.appendChild(who);
      const v = el("div", "rec-val", fmt(top[rec.key], rec.digits)); v.appendChild(el("small", null, " " + rec.unit));
      card.appendChild(v);
      card.onclick = () => openProfile(top);
      box.appendChild(card);
    });
  }

  /* ---------- Timeline ---------- */
  function renderTimeline() {
    const ol = $("tl"); ol.textContent = "";
    const items = autoTimeline.map((e) => ({ date: e.date, title: e.title, text: e.player ? "by " + e.player : "", player: e.player }))
      .concat(manualEvents.map((e) => ({ date: e.date, title: e.title, text: e.text || "" })))
      .filter((e) => e.date && e.title)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (!items.length) { const li = el("li", "empty"); li.innerHTML = "<strong>Nothing yet</strong>Big moments show up here as players reach them."; ol.appendChild(li); return; }
    items.forEach((e) => {
      const li = el("li", "tl-item");
      li.appendChild(el("time", "tl-date", new Date(e.date).toLocaleDateString([], { month: "short", day: "numeric" })));
      const body = el("div", "tl-body");
      body.appendChild(el("strong", null, e.title));
      if (e.player) { const who = el("span", "tl-who"); who.appendChild(head(e.player, 18)); who.append(e.player); body.appendChild(who); }
      else if (e.text) body.appendChild(el("span", "tl-who", e.text));
      li.appendChild(body);
      ol.appendChild(li);
    });
  }

  /* ---------- Player profile ---------- */
  const PROFILE_STATS = [
    ["playtime_hours", "Playtime", "hrs", 1], ["deaths", "Deaths", "", 0], ["since_death_hours", "Since last death", "hrs", 1],
    ["mob_kills", "Mob kills", "", 0], ["player_kills", "Player kills", "", 0], ["diamonds", "Diamond ores", "", 0],
    ["blocks_mined", "Blocks mined", "", 0], ["blocks_placed", "Blocks placed", "", 0], ["items_crafted", "Items crafted", "", 0],
    ["villager_trades", "Villager trades", "", 0], ["fish_caught", "Fish caught", "", 0], ["jumps", "Jumps", "", 0],
    ["distance_km", "Distance", "km", 1], ["elytra_km", "Elytra", "km", 1], ["advancements", "Advancements", "", 0]
  ];
  function openProfileByName(name) {
    const p = players.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
    if (p) openProfile(p);
  }
  function openProfile(p) {
    const box = $("pf"); box.textContent = "";
    const top = el("div", "pf-top"); top.appendChild(head(p.name, 72));
    const tt = el("div"); const h = el("h3", null, p.name); h.id = "pfName"; tt.appendChild(h);
    if (p.fav_mob) tt.appendChild(el("div", "pf-sub", "Favorite mob to kill: " + p.fav_mob.name + " (" + fmt(p.fav_mob.count) + ")"));
    top.appendChild(tt); box.appendChild(top);

    const grid = el("div", "pf-grid");
    PROFILE_STATS.forEach(([k, label, unit, digits]) => {
      const c = el("div", "pf-stat");
      c.appendChild(el("div", "eyebrow", label));
      const v = el("div", "pf-v", fmt(p[k], digits)); if (unit) v.appendChild(el("small", null, " " + unit));
      c.appendChild(v); grid.appendChild(c);
    });
    box.appendChild(grid);

    const lists = el("div", "pf-lists");
    const mk = (title, arr) => {
      const w = el("div"); w.appendChild(el("div", "eyebrow", title));
      const ul = el("ul", "pf-list");
      if (!arr || !arr.length) ul.appendChild(el("li", "note", "None yet"));
      (arr || []).forEach((x) => { const li = el("li"); li.appendChild(el("span", null, x.name)); li.appendChild(el("b", null, fmt(x.count))); ul.appendChild(li); });
      w.appendChild(ul); return w;
    };
    lists.appendChild(mk("Most killed", p.top_kills));
    lists.appendChild(mk("Killed by", p.killed_by));
    box.appendChild(lists);

    const adv = p.adv_list || [];
    const have = new Set(adv.map((a) => a.id));
    const total = Object.keys(ADV).length;
    const aw = el("div", "pf-adv");
    aw.appendChild(el("div", "eyebrow", "Advancements unlocked · " + adv.length + (total ? " of " + total : "")));
    const chips = el("div", "chips");
    if (!adv.length) chips.appendChild(el("span", "note", "None yet"));
    adv.forEach((a) => {
      const info = ADV[a.id];
      const c = el("span", "chip", info ? info.title : a.title);
      c.title = (info ? info.how + " " : "") + (a.time ? "Unlocked " + new Date(a.time).toLocaleDateString() : "");
      chips.appendChild(c);
    });
    aw.appendChild(chips); box.appendChild(aw);

    const locked = Object.entries(ADV).filter(([id]) => !have.has(id));
    if (locked.length) {
      const det = el("details", "pf-locked");
      det.appendChild(el("summary", null, "Still to unlock · " + locked.length + " (how to get them)"));
      const CATS = { story: "Minecraft", nether: "Nether", end: "The End", adventure: "Adventure", husbandry: "Husbandry" };
      Object.keys(CATS).forEach((cat) => {
        const items = locked.filter(([, v]) => v.cat === cat);
        if (!items.length) return;
        det.appendChild(el("div", "eyebrow lk-cat", CATS[cat] + " · " + items.length));
        const ul = el("ul", "lk-list");
        items.forEach(([, v]) => { const li = el("li"); li.appendChild(el("strong", null, v.title)); li.appendChild(el("span", null, v.how)); ul.appendChild(li); });
        det.appendChild(ul);
      });
      box.appendChild(det);
    }

    const dlg = $("profile");
    if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
    try { history.replaceState(null, "", "#player-" + encodeURIComponent(p.name)); } catch (e) {}
  }
  function closeProfile() {
    const dlg = $("profile"); if (dlg.open) dlg.close ? dlg.close() : dlg.removeAttribute("open");
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }
  $("pfClose").onclick = closeProfile;
  $("profile").addEventListener("click", (e) => { if (e.target === $("profile")) closeProfile(); });
  $("profile").addEventListener("close", () => { try { if (location.hash.startsWith("#player-")) history.replaceState(null, "", location.pathname + location.search); } catch (e) {} });

  /* ---------- data loading ---------- */
  async function loadLeaderboard() {
    try {
      const res = await fetch("data/leaderboard.json?t=" + Date.now());
      const d = await res.json();
      players = Array.isArray(d.players) ? d.players : [];
      autoTimeline = Array.isArray(d.timeline) ? d.timeline : [];
      $("lbUpdated").textContent = d.updated ? "Stats last synced " + new Date(d.updated).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + ". Syncs about every 30 minutes." : "";
    } catch (e) { players = []; }
    try { const r = await fetch("data/events.json?t=" + Date.now()); const ev = await r.json(); manualEvents = Array.isArray(ev) ? ev : []; } catch (e) { manualEvents = []; }
    if (!Object.keys(ADV).length) { try { const r = await fetch("data/advancements.json"); ADV = (await r.json()) || {}; } catch (e) { ADV = {}; } }
    renderBoard(); renderHall(); renderTimeline();
    const m = location.hash.match(/^#player-(.+)$/);
    if (m && !$("profile").open) openProfileByName(decodeURIComponent(m[1]));
  }

  renderTabs();
  refreshStatus();
  loadLeaderboard();
  setInterval(refreshStatus, Math.max(30, CFG.refreshSeconds || 60) * 1000);
  setInterval(loadLeaderboard, 5 * 60 * 1000);
})();

/* World map: only show the embedded map once its files exist */
(function () {
  const frame = document.querySelector(".mapframe");
  if (!frame) return;
  const iframe = frame.querySelector("iframe");
  const src = iframe.getAttribute("src");
  iframe.removeAttribute("src");
  const msg = document.createElement("div");
  msg.className = "map-wait";
  msg.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:24px;color:var(--muted);font-size:14px;background:rgba(15,11,26,.6)";
  msg.innerHTML = "<strong>The world map is being copied to the site</strong><span>It appears here automatically once the first copy finishes. Until then, use <em>Live map with players</em> below.</span>";
  frame.appendChild(msg);
  fetch("map/settings.json", { method: "GET", cache: "no-store" })
    .then((r) => { if (r.ok) { msg.remove(); iframe.setAttribute("src", src); } })
    .catch(() => {});
})();
