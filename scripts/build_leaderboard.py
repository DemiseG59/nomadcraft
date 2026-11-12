#!/usr/bin/env python3
"""Turn Minecraft's per-player stats files into site/data/leaderboard.json.

Expects a folder (default: mc/) containing what GitHub Actions downloaded from the server:
  mc/stats/<uuid>.json
  mc/advancements/<uuid>.json
  mc/usercache.json
If mc/stats is missing (no FTP set up yet), the existing leaderboard.json is left as is.
"""
import argparse, json, os, sys
from datetime import datetime, timezone


def load(path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


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

    players = []
    for fn in sorted(os.listdir(stats_dir)):
        if not fn.endswith(".json"):
            continue
        uuid = fn[:-5]
        data = load(os.path.join(stats_dir, fn), {}) or {}
        st = data.get("stats", {})
        custom = st.get("minecraft:custom", {})
        mined = st.get("minecraft:mined", {})

        ticks = custom.get("minecraft:play_time", custom.get("minecraft:play_one_minute", 0))
        distance_cm = sum(v for k, v in custom.items() if k.endswith("_one_cm"))

        adv = load(os.path.join(a.mc, "advancements", fn), {}) or {}
        adv_done = sum(
            1 for k, v in adv.items()
            if isinstance(v, dict) and v.get("done") and ":recipes/" not in k
        )

        players.append({
            "uuid": uuid,
            "name": names.get(uuid, uuid[:8]),
            "playtime_hours": round(ticks / 20 / 3600, 1),
            "diamonds": mined.get("minecraft:diamond_ore", 0) + mined.get("minecraft:deepslate_diamond_ore", 0),
            "mob_kills": custom.get("minecraft:mob_kills", 0),
            "player_kills": custom.get("minecraft:player_kills", 0),
            "deaths": custom.get("minecraft:deaths", 0),
            "advancements": adv_done,
            "blocks_mined": sum(mined.values()),
            "distance_km": round(distance_cm / 100000, 1),
        })

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"updated": datetime.now(timezone.utc).isoformat(), "players": players}, f, indent=1)
    print(f"Wrote {len(players)} players to {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
