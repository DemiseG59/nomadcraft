/* Nomadcraft extra sections: this week, ranks, head-to-head, server stats, activity, mods, shops, gallery. */
(function () {
  const NC = (window.NC = window.NC || {});
  const $ = (id) => document.getElementById(id);
  const fmt = NC.fmt || ((v, d) => (Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: d || 0 }));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const head = (name, size) => {
    const img = document.createElement("img");
    img.alt = ""; img.loading = "lazy"; img.width = size; img.height = size;
    img.src = "https://mc-heads.net/avatar/" + encodeURIComponent(name) + "/" + size;
    img.onerror = () => img.removeAttribute("src");
    return img;
  };
  const open = (name) => NC.openProfileByName && NC.openProfileByName(name);
  const getJSON = (url) => fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now()).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  const LABELS = {
    xp: ["Nomad XP", "XP", 0], playtime_hours: ["Hours played", "hrs", 1], diamonds: ["Diamond ores mined", "", 0],
    mob_kills: ["Mobs killed", "", 0], blocks_placed: ["Blocks placed", "", 0], blocks_mined: ["Blocks mined", "", 0],
    villager_trades: ["Villager trades", "", 0], elytra_km: ["Elytra distance", "km", 1], advancements: ["Advancements", "", 0],
    distance_km: ["Distance traveled", "km", 1], fish_caught: ["Fish caught", "", 0], deaths: ["Deaths", "", 0],
    player_kills: ["Player kills", "", 0], items_crafted: ["Items crafted", "", 0], jumps: ["Jumps", "", 0]
  };
  const label = (k) => (LABELS[k] || [k])[0];
  const unit = (k) => (LABELS[k] || ["", ""])[1];
  const digits = (k) => (LABELS[k] || ["", "", 0])[2];

  let lb = null, hist = null;

  /* ---------- Random fact ---------- */
  function facts() {
    const P = (lb && lb.players) || [];
    const T = (lb && lb.server && lb.server.totals) || {};
    const D = (lb && lb.server && lb.server.death_causes) || [];
    const top = (k) => P.slice().sort((a, b) => (b[k] || 0) - (a[k] || 0))[0];
    const out = [];
    const add = (k, tpl) => { const p = top(k); if (p && p[k] > 0) out.push(tpl(p.name, fmt(p[k], digits(k)))); };
    add("mob_kills", (n, v) => n + " has killed " + v + " mobs.");
    add("diamonds", (n, v) => n + " has mined " + v + " diamond ores.");
    add("elytra_km", (n, v) => n + " has flown " + v + " km with elytra.");
    add("blocks_placed", (n, v) => n + " has placed " + v + " blocks.");
    add("jumps", (n, v) => n + " has jumped " + v + " times.");
    add("villager_trades", (n, v) => n + " has traded with villagers " + v + " times.");
    add("since_death_hours", (n, v) => n + " hasn't died in " + v + " hours.");
    add("xp", (n, v) => n + " leads the server with " + v + " Nomad XP.");
    if (T.blocks_placed) out.push("Together the server has placed " + fmt(T.blocks_placed) + " blocks.");
    if (T.playtime_hours) out.push("Nomads have played " + fmt(T.playtime_hours) + " hours combined.");
    if (T.distance_km) out.push("Everyone has traveled " + fmt(T.distance_km) + " km combined.");
    if (D[0]) out.push(D[0].name + " is the top killer on the server, with " + fmt(D[0].count) + " kills.");
    return out;
  }
  let factTimer = null;
  function renderFact() {
    const box = $("fact"); if (!box) return;
    const list = facts(); if (!list.length) { box.hidden = true; return; }
    box.hidden = false;
    let i = Math.floor(Math.random() * list.length);
    const show = () => { box.querySelector("span").textContent = list[i % list.length]; i++; };
    show(); clearInterval(factTimer); factTimer = setInterval(show, 7000);
  }

  /* ---------- This week ---------- */
  function resetCountdown() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    const dayIdx = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[parts.weekday] || 0;
    const minsLeft = (7 - dayIdx) * 1440 - ((Number(parts.hour) % 24) * 60 + Number(parts.minute));
    const d = Math.floor(minsLeft / 1440), h = Math.floor((minsLeft % 1440) / 60);
    return "Resets in " + (d ? d + "d " : "") + h + "h";
  }
  function niceMilestone(v) {
    const steps = [1, 2.5, 5];
    let mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, v)))));
    for (let k = 0; k < 20; k++) { for (const s of steps) { const m = s * mag; if (m > v) return m; } mag *= 10; }
    return v * 2;
  }
  function renderWeek() {
    const box = $("weekBody"); if (!box) return;
    box.textContent = "";
    $("weekReset").textContent = resetCountdown();
    const w = hist && hist.week;
    const gains = (w && w.gains) || [];
    const anyGain = gains.some((g) => g.xp > 0);

    const grid = el("div", "week-grid");
    // Player of the week
    const potw = el("div", "potw");
    potw.appendChild(el("div", "eyebrow", "Player of the week"));
    if (anyGain) {
      const best = gains.slice().sort((a, b) => b.xp - a.xp)[0];
      const who = el("button", "potw-who"); who.type = "button"; who.onclick = () => open(best.name);
      who.appendChild(head(best.name, 64));
      const t = el("div"); t.appendChild(el("strong", null, best.name)); t.appendChild(el("span", null, "+" + fmt(best.xp) + " XP this week"));
      who.appendChild(t); potw.appendChild(who);
    } else {
      potw.appendChild(el("p", "note", "Nobody has earned XP yet this week. Get on and claim the top spot."));
    }
    const past = (hist && hist.past_weeks) || [];
    if (past[0]) potw.appendChild(el("p", "small", "Last week: " + past[0].champion + " (+" + fmt(past[0].xp) + " XP)"));
    grid.appendChild(potw);

    // Weekly challenges
    (w && w.challenges ? w.challenges : ["diamonds", "mob_kills", "blocks_placed"]).forEach((k) => {
      const c = el("div", "challenge");
      c.appendChild(el("div", "eyebrow", "Weekly challenge"));
      c.appendChild(el("h3", null, "Most " + label(k).toLowerCase()));
      const ranked = gains.filter((g) => g[k] > 0).sort((a, b) => b[k] - a[k]).slice(0, 3);
      if (!ranked.length) c.appendChild(el("p", "note", "No one yet. First to start leads."));
      const max = Math.max(1, ...ranked.map((g) => g[k]));
      ranked.forEach((g, i) => {
        const r = el("button", "ch-row"); r.type = "button"; r.onclick = () => open(g.name);
        r.appendChild(el("b", "ch-pos p" + (i + 1), String(i + 1)));
        const nm = el("span", "ch-name"); nm.appendChild(head(g.name, 20)); nm.append(g.name); r.appendChild(nm);
        r.appendChild(el("span", "ch-val", "+" + fmt(g[k], digits(k)) + (unit(k) ? " " + unit(k) : "")));
        const bar = el("i", "ch-bar"); bar.style.width = (g[k] / max) * 100 + "%"; r.appendChild(bar);
        c.appendChild(r);
      });
      grid.appendChild(c);
    });
    box.appendChild(grid);

    // Community goals
    const T = (lb && lb.server && lb.server.totals) || {};
    const goals = el("div", "goals");
    [["diamonds", "Diamond ores mined"], ["mob_kills", "Mobs killed"], ["blocks_placed", "Blocks placed"], ["playtime_hours", "Hours played"]].forEach(([k, name]) => {
      const cur = Number(T[k]) || 0; if (!cur) return;
      const goal = niceMilestone(cur);
      const g = el("div", "goal");
      const top = el("div", "goal-top"); top.appendChild(el("strong", null, name)); top.appendChild(el("span", null, fmt(cur) + " / " + fmt(goal))); g.appendChild(top);
      const bar = el("div", "xpbar"); const f = el("i"); f.style.width = Math.min(100, (cur / goal) * 100) + "%"; bar.appendChild(f); g.appendChild(bar);
      goals.appendChild(g);
    });
    if (goals.children.length) {
      box.appendChild(el("div", "eyebrow goals-title", "Server goals · everyone works toward these together"));
      box.appendChild(goals);
    }
    if (w && w.since && w.since !== w.start) box.appendChild(el("p", "small", "Weekly tracking started " + new Date(w.since + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" }) + "."));
  }

  /* ---------- Ranks ---------- */
  function renderRanks() {
    const box = $("ranksBody"); if (!box || !lb) return;
    box.textContent = "";
    const ranks = lb.ranks || [];
    const P = (lb.players || []).slice().sort((a, b) => (b.xp || 0) - (a.xp || 0));
    const ladder = el("ol", "ladder");
    ranks.slice().reverse().forEach((r, idx, arr) => {
      const nextLv = idx === 0 ? Infinity : arr[idx - 1].level;
      const li = el("li", "rung" + (P.some((p) => p.level >= r.level && p.level < nextLv) ? " has" : ""));
      const lbl = el("div", "rung-lbl"); lbl.appendChild(el("strong", null, r.name)); lbl.appendChild(el("span", null, "Level " + r.level + "+ · " + fmt(100 * r.level * r.level) + " XP")); li.appendChild(lbl);
      const who = el("div", "rung-who");
      P.filter((p) => p.level >= r.level && p.level < nextLv).forEach((p) => {
        const b = el("button", "rung-p"); b.type = "button"; b.title = p.name + " · Level " + p.level; b.onclick = () => open(p.name);
        b.appendChild(head(p.name, 24)); b.append(p.name); who.appendChild(b);
      });
      li.appendChild(who); ladder.appendChild(li);
    });
    box.appendChild(ladder);

    const wts = lb.xp_weights || {};
    const guide = el("div", "xp-guide");
    guide.appendChild(el("div", "eyebrow", "How to earn XP"));
    const ul = el("ul");
    const names = { playtime_hours: ["hour played", "hours played"], advancements: ["advancement", "advancements"], diamonds: ["diamond ore", "diamond ores"], mob_kills: ["mob killed", "mobs killed"], blocks_placed: ["block placed", "blocks placed"], blocks_mined: ["block mined", "blocks mined"], villager_trades: ["villager trade", "villager trades"], elytra_km: ["km of elytra flight", "km of elytra flight"], fish_caught: ["fish caught", "fish caught"], distance_km: ["km traveled", "km traveled"], items_crafted: ["item crafted", "items crafted"] };
    Object.entries(wts).sort((a, b) => b[1] - a[1]).forEach(([k, w]) => {
      const n = names[k] || [k, k];
      const txt = w >= 1 ? "1 " + n[0] + " = " + fmt(w) + " XP" : fmt(1 / w) + " " + n[1] + " = 1 XP";
      ul.appendChild(el("li", null, txt));
    });
    guide.appendChild(ul);
    guide.appendChild(el("p", "small", "Level n needs 100 × n² XP. The climb gets steeper the higher you go."));
    box.appendChild(guide);
  }

  /* ---------- Head-to-head ---------- */
  const VS_KEYS = ["xp", "playtime_hours", "diamonds", "mob_kills", "player_kills", "deaths", "blocks_placed", "blocks_mined", "villager_trades", "elytra_km", "distance_km", "fish_caught", "advancements"];
  function renderVersus() {
    const box = $("vsBody"); if (!box || !lb) return;
    const P = (lb.players || []).slice().sort((a, b) => (b.xp || 0) - (a.xp || 0));
    if (P.length < 2) { box.textContent = ""; box.appendChild(el("p", "note", "Need at least two players to compare.")); return; }
    const a = $("vsA"), b = $("vsB");
    if (!a.options.length) {
      P.forEach((p) => { a.add(new Option(p.name, p.name)); b.add(new Option(p.name, p.name)); });
      a.value = P[0].name; b.value = P[1].name;
      a.onchange = b.onchange = drawVersus;
    }
    drawVersus();
  }
  function drawVersus() {
    const P = lb.players || [];
    const A = P.find((p) => p.name === $("vsA").value), B = P.find((p) => p.name === $("vsB").value);
    const box = $("vsBody"); box.textContent = "";
    if (!A || !B) return;
    const hdr = el("div", "vs-hdr");
    [A, B].forEach((p, i) => {
      const s = el("button", "vs-p vs-" + (i ? "b" : "a")); s.type = "button"; s.onclick = () => open(p.name);
      s.appendChild(head(p.name, 40)); const t = el("div"); t.appendChild(el("strong", null, p.name)); t.appendChild(el("span", null, "Lv " + (p.level || 0) + " " + (p.rank || ""))); s.appendChild(t);
      hdr.appendChild(s);
      if (!i) hdr.appendChild(el("span", "vs-x", "vs"));
    });
    box.appendChild(hdr);
    let wa = 0, wb = 0;
    VS_KEYS.forEach((k) => {
      const va = Number(A[k]) || 0, vb = Number(B[k]) || 0;
      const lowerWins = k === "deaths";
      const aWin = lowerWins ? va < vb : va > vb, bWin = lowerWins ? vb < va : vb > va;
      if (aWin) wa++; if (bWin) wb++;
      const max = Math.max(va, vb, 1);
      const row = el("div", "vs-row");
      const left = el("div", "vs-side l" + (aWin ? " win" : "")); left.appendChild(el("span", "vs-num", fmt(va, digits(k)))); const lb1 = el("i", "vs-bar a"); lb1.style.width = (va / max) * 100 + "%"; left.appendChild(lb1);
      const mid = el("div", "vs-lbl", label(k) + (lowerWins ? " (fewer wins)" : ""));
      const right = el("div", "vs-side r" + (bWin ? " win" : "")); const rb = el("i", "vs-bar b"); rb.style.width = (vb / max) * 100 + "%"; right.appendChild(rb); right.appendChild(el("span", "vs-num", fmt(vb, digits(k))));
      row.append(left, mid, right); box.appendChild(row);
    });
    box.appendChild(el("p", "vs-score", A.name + " wins " + wa + " · " + B.name + " wins " + wb));
  }

  /* ---------- Server stats ---------- */
  function renderServer() {
    const box = $("serverBody"); if (!box || !lb || !lb.server) return;
    box.textContent = "";
    const T = lb.server.totals || {};
    const tiles = el("div", "tot-grid");
    [["playtime_hours", "Hours played"], ["diamonds", "Diamond ores"], ["mob_kills", "Mobs killed"], ["blocks_placed", "Blocks placed"], ["blocks_mined", "Blocks mined"], ["deaths", "Deaths"], ["villager_trades", "Villager trades"], ["distance_km", "Km traveled"]].forEach(([k, name]) => {
      const t = el("div", "tot"); t.appendChild(el("div", "eyebrow", name)); t.appendChild(el("div", "tot-v", fmt(T[k]))); tiles.appendChild(t);
    });
    box.appendChild(tiles);

    const D = (lb.server.death_causes || []).slice(0, 8);
    const chart = el("div", "deaths");
    chart.appendChild(el("h3", null, "What's killing everyone"));
    if (!D.length) chart.appendChild(el("p", "note", "Nobody has died yet."));
    const max = Math.max(1, ...D.map((d) => d.count));
    const total = D.reduce((s, d) => s + d.count, 0);
    D.forEach((d) => {
      const r = el("div", "d-row");
      r.title = d.name + ": " + fmt(d.count) + " deaths (" + Math.round((d.count / Math.max(1, total)) * 100) + "%)";
      r.appendChild(el("span", "d-name", d.name));
      const track = el("div", "d-track"); const bar = el("i"); bar.style.width = (d.count / max) * 100 + "%"; track.appendChild(bar); r.appendChild(track);
      r.appendChild(el("span", "d-val", fmt(d.count)));
      chart.appendChild(r);
    });
    box.appendChild(chart);
  }

  /* ---------- Activity ---------- */
  function renderActivity() {
    const box = $("activityBody"); if (!box) return;
    box.textContent = "";
    const A = ((hist && hist.activity) || []).map((p) => ({ t: new Date(p.t), n: p.n || 0 })).filter((p) => !isNaN(p.t));
    const since = Date.now() - 7 * 864e5;
    const pts = A.filter((p) => p.t >= since);
    if (pts.length < 3) {
      box.appendChild(el("p", "note empty-chart", "Activity tracking just started. This fills in as the site checks the server every 30 minutes."));
      return;
    }
    // Line chart: players online, last 7 days
    const W = 720, H = 220, L = 34, R = 12, Tp = 12, B = 28;
    const x0 = since, x1 = Date.now();
    const maxN = Math.max(4, ...pts.map((p) => p.n));
    const yMax = Math.ceil(maxN / 2) * 2;
    const X = (t) => L + ((t - x0) / (x1 - x0)) * (W - L - R);
    const Y = (n) => Tp + (1 - n / yMax) * (H - Tp - B);
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("class", "act-svg"); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Players online over the last 7 days, peak " + maxN);
    const mk = (tag, attrs) => { const e = document.createElementNS(ns, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
    for (let i = 0; i <= 4; i++) {
      const v = (yMax / 4) * i, y = Y(v);
      svg.appendChild(mk("line", { x1: L, x2: W - R, y1: y, y2: y, class: "grid" }));
      const t = mk("text", { x: L - 6, y: y + 4, class: "axis", "text-anchor": "end" }); t.textContent = fmt(v, 1); svg.appendChild(t);
    }
    for (let d = 0; d <= 7; d++) {
      const t = x0 + d * 864e5; const lbl = new Date(t).toLocaleDateString([], { weekday: "short" });
      const tx = mk("text", { x: X(t), y: H - 8, class: "axis", "text-anchor": d === 0 ? "start" : d === 7 ? "end" : "middle" }); tx.textContent = d === 7 ? "Now" : lbl; svg.appendChild(tx);
    }
    // Split the line where a check was missed for over 2 hours
    let path = "", area = "", seg = [];
    const flush = () => {
      if (!seg.length) return;
      path += "M" + seg.map((p) => X(p.t).toFixed(1) + "," + Y(p.n).toFixed(1)).join("L");
      area += "M" + X(seg[0].t).toFixed(1) + "," + Y(0) + "L" + seg.map((p) => X(p.t).toFixed(1) + "," + Y(p.n).toFixed(1)).join("L") + "L" + X(seg[seg.length - 1].t).toFixed(1) + "," + Y(0) + "Z";
      seg = [];
    };
    pts.forEach((p, i) => { if (i && p.t - pts[i - 1].t > 2 * 3600e3) flush(); seg.push(p); }); flush();
    svg.appendChild(mk("path", { d: area, class: "area" }));
    svg.appendChild(mk("path", { d: path, class: "line" }));
    const last = pts[pts.length - 1];
    svg.appendChild(mk("circle", { cx: X(last.t), cy: Y(last.n), r: 4, class: "dot" }));
    // Hover
    const guide = mk("line", { y1: Tp, y2: H - B, class: "guide", visibility: "hidden" });
    const hdot = mk("circle", { r: 4, class: "dot", visibility: "hidden" });
    svg.appendChild(guide); svg.appendChild(hdot);
    const wrap = el("div", "act-wrap");
    const tip = el("div", "tip"); tip.hidden = true;
    wrap.appendChild(el("h3", null, "Players online · last 7 days"));
    const plot = el("div", "act-plot"); plot.appendChild(svg); plot.appendChild(tip); wrap.appendChild(plot);
    svg.addEventListener("mousemove", (e) => {
      const r = svg.getBoundingClientRect(); const mx = ((e.clientX - r.left) / r.width) * W;
      const t = x0 + ((mx - L) / (W - L - R)) * (x1 - x0);
      let best = pts[0]; pts.forEach((p) => { if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p; });
      const cx = X(best.t), cy = Y(best.n);
      guide.setAttribute("x1", cx); guide.setAttribute("x2", cx); guide.setAttribute("visibility", "visible");
      hdot.setAttribute("cx", cx); hdot.setAttribute("cy", cy); hdot.setAttribute("visibility", "visible");
      tip.hidden = false; tip.textContent = best.t.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) + " · " + best.n + " online";
      const px = (cx / W) * r.width; tip.style.left = Math.min(Math.max(px, 70), r.width - 70) + "px"; tip.style.top = (cy / H) * r.height - 34 + "px";
    });
    svg.addEventListener("mouseleave", () => { guide.setAttribute("visibility", "hidden"); hdot.setAttribute("visibility", "hidden"); tip.hidden = true; });
    box.appendChild(wrap);

    // Busiest hours (Chicago time), all history
    const sums = Array(24).fill(0), cnt = Array(24).fill(0);
    A.forEach((p) => { const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false }).format(p.t)) % 24; sums[h] += p.n; cnt[h]++; });
    const avg = sums.map((s, i) => (cnt[i] ? s / cnt[i] : 0));
    const maxA = Math.max(0.5, ...avg);
    const hrs = el("div", "hours");
    hrs.appendChild(el("h3", null, "Busiest times (Central time)"));
    const bars = el("div", "h-bars");
    avg.forEach((v, h) => {
      const c = el("div", "h-col"); c.title = (h % 12 || 12) + (h < 12 ? " AM" : " PM") + ": " + fmt(v, 1) + " online on average";
      const b = el("i"); b.style.height = Math.max(2, (v / maxA) * 100) + "%"; if (!cnt[h]) b.className = "nodata"; c.appendChild(b);
      bars.appendChild(c);
    });
    hrs.appendChild(bars);
    const axis = el("div", "h-axis"); ["12a", "6a", "12p", "6p", "12a"].forEach((t) => axis.appendChild(el("span", null, t))); hrs.appendChild(axis);
    box.appendChild(hrs);
  }

  /* ---------- Mods ---------- */
  let modsData = null, modsAll = false;
  function renderMods() {
    const box = $("modsBody"); if (!box) return;
    const list = (modsData && modsData.mods) || [];
    $("modsCount").textContent = list.length ? list.length + " mods" : "";
    box.textContent = "";
    if (!list.length) { box.appendChild(el("p", "note", "The mod list appears after the next sync.")); $("modsMore").hidden = true; return; }
    const q = ($("modSearch").value || "").trim().toLowerCase();
    const hits = list.filter((m) => !q || (m.name + " " + (m.description || "") + " " + (m.authors || "")).toLowerCase().includes(q));
    const shown = q || modsAll ? hits : hits.slice(0, 18);
    shown.forEach((m) => {
      const a = el("a", "mod"); a.href = m.url || "#"; a.target = "_blank"; a.rel = "noopener";
      const ic = el("div", "mod-ic");
      if (m.icon) { const img = document.createElement("img"); img.src = m.icon; img.alt = ""; img.loading = "lazy"; img.onerror = () => img.remove(); ic.appendChild(img); }
      else ic.textContent = (m.name || "?").charAt(0).toUpperCase();
      a.appendChild(ic);
      const body = el("div", "mod-body");
      const t = el("div", "mod-top"); t.appendChild(el("strong", null, m.name)); if (m.version) t.appendChild(el("span", "mod-ver", m.version)); body.appendChild(t);
      if (m.description) body.appendChild(el("p", null, m.description));
      body.appendChild(el("span", "mod-src " + (m.source || ""), m.source === "modrinth" ? "Download on Modrinth" : "Find on CurseForge"));
      a.appendChild(body);
      box.appendChild(a);
    });
    if (!hits.length) box.appendChild(el("p", "note", "No mods match that search."));
    const more = $("modsMore");
    more.hidden = !!q || modsAll || hits.length <= 18;
    more.textContent = "Show all " + hits.length + " mods";
  }

  /* ---------- Shops ---------- */
  function renderShops(shops) {
    const box = $("shopsBody"); if (!box) return;
    box.textContent = "";
    if (!shops || !shops.length) { box.appendChild(el("p", "note", "Shop listings are coming soon. Check back after the shopping district fills up.")); return; }
    shops.forEach((s) => {
      const c = el("div", "shop");
      const top = el("div", "shop-top");
      if (s.owner) top.appendChild(head(s.owner, 32));
      const t = el("div"); t.appendChild(el("strong", null, s.name || "Shop")); const sub = [s.owner, s.location].filter(Boolean).join(" · "); if (sub) t.appendChild(el("span", null, sub)); top.appendChild(t);
      c.appendChild(top);
      if (s.description) c.appendChild(el("p", "shop-desc", s.description));
      const ul = el("ul", "shop-items");
      (s.items || []).forEach((it) => { const li = el("li"); li.appendChild(el("span", null, it.item)); li.appendChild(el("b", null, it.price)); ul.appendChild(li); });
      c.appendChild(ul);
      box.appendChild(c);
    });
  }

  /* ---------- Gallery ---------- */
  function renderGallery(items) {
    const box = $("galleryBody"); if (!box) return;
    box.textContent = "";
    if (!items || !items.length) { box.appendChild(el("p", "note", "Screenshots coming soon.")); return; }
    items.forEach((g) => {
      const b = el("button", "shot"); b.type = "button";
      const img = document.createElement("img"); img.src = g.src; img.alt = g.caption || "Nomadcraft screenshot"; img.loading = "lazy"; b.appendChild(img);
      if (g.caption) b.appendChild(el("span", null, g.caption + (g.by ? " · " + g.by : "")));
      b.onclick = () => {
        const d = $("lightbox"); d.querySelector("img").src = g.src; d.querySelector("img").alt = g.caption || "";
        d.querySelector("p").textContent = (g.caption || "") + (g.by ? " · by " + g.by : "");
        if (d.showModal) d.showModal(); else d.setAttribute("open", "");
      };
      box.appendChild(b);
    });
  }

  /* ---------- Wiring ---------- */
  function renderAll() { renderFact(); renderWeek(); renderRanks(); renderVersus(); renderServer(); }

  document.addEventListener("nc:data", () => {
    getJSON("data/leaderboard.json").then((d) => { if (d) { lb = d; renderAll(); } });
  });
  getJSON("data/leaderboard.json").then((d) => { if (d) { lb = d; renderAll(); } });
  getJSON("data/history.json").then((h) => { hist = h; NC.history = h; renderWeek(); renderActivity(); renderFact(); });
  getJSON("data/mods.json").then((m) => { modsData = m; renderMods(); });
  getJSON("data/shops.json").then(renderShops);
  getJSON("data/gallery.json").then(renderGallery);

  const ms = $("modSearch"); if (ms) ms.addEventListener("input", renderMods);
  const mm = $("modsMore"); if (mm) mm.addEventListener("click", () => { modsAll = true; renderMods(); });
  const lbx = $("lightbox");
  if (lbx) { lbx.addEventListener("click", (e) => { if (e.target === lbx || e.target.classList.contains("lb-close")) lbx.close(); }); }
  setInterval(() => { const r = $("weekReset"); if (r) r.textContent = resetCountdown(); }, 60000);
})();
