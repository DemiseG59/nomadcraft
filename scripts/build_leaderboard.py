#!/usr/bin/env python3
"""Turn Minecraft's per-player stats and advancements into site/data/leaderboard.json.

Expects a folder (default: mc/) containing what GitHub Actions downloaded from the server:
  mc/stats/<uuid>.json
  mc/advancements/<uuid>.json
  mc/usercache.json
If mc/stats is missing, the existing leaderboard.json is left as is.
"""
import argparse, json, os, sys
from datetime import datetime, timezone

# Item names (or parts of names) that are "used" but are not blocks being placed.
NOT_BLOCKS = (
    "sword", "pickaxe", "_axe", "shovel", "_hoe", "bow", "trident", "shield", "bucket",
    "flint_and_steel", "shears", "fishing_rod", "ender_pearl", "ender_eye", "firework_rocket",
    "potion", "totem", "elytra", "spyglass", "compass", "map", "snowball", "egg", "bottle",
    "apple", "bread", "beef", "porkchop", "chicken", "mutton", "cod", "salmon", "potato",
    "carrot", "cookie", "pie", "stew", "soup", "melon_slice", "berries", "rabbit", "beetroot",
    "chorus_fruit", "dried_kelp", "honey", "bone_meal", "spawn_egg", "helmet", "chestplate",
    "leggings", "boots", "lead", "name_tag", "saddle", "boat", "minecart", "brush", "mace",
    "wind_charge", "goat_horn", "book", "written", "experience", "fire_charge",
)

# Server "firsts" built from advancement completion times.
FIRSTS = [
    ("minecraft:story/mine_diamond", "First diamonds mined"),
    ("minecraft:story/enter_the_nether", "First trip to the Nether"),
    ("minecraft:nether/find_fortress", "First Nether fortress found"),
    ("minecraft:nether/obtain_ancient_debris", "First ancient debris"),
    ("minecraft:adventure/trade", "First villager trade"),
    ("minecraft:story/cure_zombie_villager", "First zombie villager cured"),
    ("minecraft:story/follow_ender_eye", "Stronghold found"),
    ("minecraft:story/enter_the_end", "First into the End"),
    ("minecraft:end/kill_dragon", "Ender Dragon defeated"),
    ("minecraft:end/find_end_city", "First End city found"),
    ("minecraft:end/elytra", "First elytra"),
    ("minecraft:nether/summon_wither", "Wither summoned"),
    ("minecraft:nether/create_full_beacon", "First full beacon"),
    ("minecraft:adventure/totem_of_undying", "Cheated death with a totem"),
]


def load(path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def strip(k):
    return k.split(":", 1)[-1]


def pretty(k):
    k = strip(k).split("/")[-1]
    return k.replace("_", " ").strip().title()


def adv_time(entry):
    """Latest criterion time = when the advancement was completed."""
    best = None
    for t in (entry.get("criteria") or {}).values():
        try:
            d = datetime.strptime(t, "%Y-%m-%d %H:%M:%S %z")
        except Exception:
            continue
        if best is None or d > best:
            best = d
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mc", default="mc")
    ap.add_argument("--out", default="site/data/leaderboard.json")
    a = ap.parse_args()

    stats_dir = os.path.join(a.mc, "stats")
    if not os.path.isdir(stats_dir):
        print("No stats folder found; keeping the current leaderboard.json.")
        return 0

    names = {}
    for e in load(os.path.join(a.mc, "usercache.json"), []) or []:
        if isinstance(e, dict) and e.get("uuid") and e.get("name"):
            names[e["uuid"]] = e["name"]

    players, firsts = [], {}
    for fn in sorted(os.listdir(stats_dir)):
        if not fn.endswith(".json"):
            continue
        uuid = fn[:-5]
        name = names.get(uuid, uuid[:8])
        st = (load(os.path.join(stats_dir, fn), {}) or {}).get("stats", {})
        custom = st.get("minecraft:custom", {})
        mined = st.get("minecraft:mined", {})
        used = st.get("minecraft:used", {})
        crafted = st.get("minecraft:crafted", {})
        killed = st.get("minecraft:killed", {})
        killed_by = st.get("minecraft:killed_by", {})

        ticks = custom.get("minecraft:play_time", custom.get("minecraft:play_one_minute", 0))
        distance_cm = sum(v for k, v in custom.items() if k.endswith("_one_cm"))
        placed = sum(v for k, v in used.items() if not any(x in strip(k) for x in NOT_BLOCKS))

        top_kills = sorted(killed.items(), key=lambda kv: -kv[1])[:6]
        top_killers = sorted(killed_by.items(), key=lambda kv: -kv[1])[:4]

        adv = load(os.path.join(a.mc, "advancements", fn), {}) or {}
        adv_list = []
        for k, v in adv.items():
            if not isinstance(v, dict) or not v.get("done") or not k.startswith("minecraft:") or ":recipes/" in k or k.endswith("/root"):
                continue
            t = adv_time(v)
            adv_list.append({"id": strip(k), "title": pretty(k), "time": t.isoformat() if t else None})
            if t and k in dict(FIRSTS):
                cur = firsts.get(k)
                if cur is None or t < cur[0]:
                    firsts[k] = (t, name)
        adv_list.sort(key=lambda x: x["time"] or "", reverse=True)

        players.append({
            "uuid": uuid,
            "name": name,
            "playtime_hours": round(ticks / 20 / 3600, 1),
            "diamonds": mined.get("minecraft:diamond_ore", 0) + mined.get("minecraft:deepslate_diamond_ore", 0),
            "mob_kills": custom.get("minecraft:mob_kills", 0),
            "player_kills": custom.get("minecraft:player_kills", 0),
            "deaths": custom.get("minecraft:deaths", 0),
            "advancements": len(adv_list),
            "blocks_mined": sum(mined.values()),
            "blocks_placed": placed,
            "villager_trades": custom.get("minecraft:traded_with_villager", 0),
            "elytra_km": round(custom.get("minecraft:aviate_one_cm", 0) / 100000, 1),
            "fish_caught": custom.get("minecraft:fish_caught", 0),
            "items_crafted": sum(crafted.values()),
            "jumps": custom.get("minecraft:jump", 0),
            "since_death_hours": round(custom.get("minecraft:time_since_death", 0) / 20 / 3600, 1),
            "distance_km": round(distance_cm / 100000, 1),
            "fav_mob": {"name": pretty(top_kills[0][0]), "count": top_kills[0][1]} if top_kills else None,
            "top_kills": [{"name": pretty(k), "count": v} for k, v in top_kills],
            "killed_by": [{"name": pretty(k), "count": v} for k, v in top_killers],
            "adv_list": adv_list,
        })

    title = dict(FIRSTS)
    timeline = sorted(
        ({"date": t.isoformat(), "title": title[k], "player": who} for k, (t, who) in firsts.items()),
        key=lambda e: e["date"],
    )

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"updated": datetime.now(timezone.utc).isoformat(), "players": players, "timeline": timeline}, f, indent=1)
    print(f"Wrote {len(players)} players and {len(timeline)} timeline events to {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
