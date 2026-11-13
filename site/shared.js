/* Shared helpers: badges and weekly gains. Loaded before app.js and extras.js. */
(function () {
  const NC = (window.NC = window.NC || {});
  const fmt = (v, d) => (Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: d || 0 });
  NC.fmt = fmt;

  const TIERS = ["bronze", "silver", "gold", "diamond"];
  const STAT_BADGES = [
    ["playtime_hours", "hours played", [10, 50, 100, 250], ["Settler", "Regular", "Veteran", "No Life"]],
    ["diamonds", "diamond ores mined", [25, 100, 250, 500], ["Shiny", "Diamond Digger", "Gem Hoarder", "Diamond King"]],
    ["mob_kills", "mobs killed", [500, 2500, 10000, 25000], ["Hunter", "Slayer", "Exterminator", "Mob Grinder"]],
    ["blocks_placed", "blocks placed", [5000, 25000, 100000, 250000], ["Builder", "Architect", "Master Builder", "World Shaper"]],
    ["blocks_mined", "blocks mined", [10000, 50000, 150000, 400000], ["Digger", "Miner", "Tunneler", "Strip Miner"]],
    ["distance_km", "km traveled", [50, 200, 500, 1000], ["Explorer", "Traveler", "Globetrotter", "True Nomad"]],
    ["villager_trades", "villager trades", [50, 250, 1000], ["Haggler", "Merchant", "Trade Baron"]],
    ["elytra_km", "km flown with elytra", [25, 100, 500], ["Glider", "Sky Pilot", "Ace"]],
    ["fish_caught", "fish caught", [10, 50, 200], ["Angler", "Fisher", "Sea Legend"]],
    ["advancements", "advancements", [25, 50, 80], ["Achiever", "Completionist", "Advancement Master"]],
    ["since_death_hours", "hours alive without dying", [5, 15, 40], ["Survivor", "Hard to Kill", "Immortal"]]
  ];
  const ADV_BADGES = [
    ["end/kill_dragon", "Dragon Slayer", "Kill the Ender Dragon"],
    ["nether/summon_wither", "Wither Summoner", "Summon the Wither"],
    ["end/elytra", "Winged", "Find a pair of elytra"],
    ["nether/netherite_armor", "Netherite Clad", "Wear full netherite armor"],
    ["nether/create_full_beacon", "Beaconator", "Build a full beacon pyramid"],
    ["adventure/totem_of_undying", "Cheated Death", "Survive death with a totem"],
    ["adventure/hero_of_the_village", "Village Hero", "Win a raid"],
    ["adventure/kill_all_mobs", "Monster Hunter", "Kill every hostile mob type"],
    ["adventure/adventuring_time", "World Traveler", "Visit every Overworld biome"],
    ["husbandry/balanced_diet", "Foodie", "Eat every food in the game"]
  ];

  const ALL = [];
  STAT_BADGES.forEach(([key, unit, goals, names]) => goals.forEach((g, i) => ALL.push({
    id: key + "-" + i, name: names[i], tier: TIERS[i], key: key, goal: g, desc: fmt(g) + " " + unit
  })));
  ADV_BADGES.forEach(([adv, name, desc]) => ALL.push({ id: adv, name: name, tier: "special", adv: adv, desc: desc }));
  NC.BADGES = ALL;

  NC.badgesFor = function (p) {
    const have = new Set((p.adv_list || []).map((a) => a.id));
    const earned = [], next = [];
    ALL.forEach((b) => {
      if (b.adv) { if (have.has(b.adv)) earned.push(b); return; }
      const cur = Number(p[b.key]) || 0;
      if (cur >= b.goal) earned.push(b);
      else next.push(Object.assign({}, b, { ratio: cur / b.goal, progressText: fmt(cur, 1) + " / " + fmt(b.goal) }));
    });
    // Closest unearned badge per stat, best three overall
    const seen = new Set();
    const close = next.sort((a, b) => b.ratio - a.ratio).filter((b) => (seen.has(b.key) ? false : seen.add(b.key))).slice(0, 3);
    return { earned: earned, next: close, total: ALL.length };
  };

  NC.badgeChip = function (b) {
    const c = document.createElement("span");
    c.className = "badge tier-" + b.tier;
    c.title = b.desc;
    const i = document.createElement("i"); i.setAttribute("aria-hidden", "true");
    c.appendChild(i); c.append(b.name);
    return c;
  };

  NC.history = null;
  NC.weekGain = function (name) {
    const w = NC.history && NC.history.week;
    if (!w || !w.gains) return null;
    return w.gains.find((g) => g.name === name) || null;
  };
})();
