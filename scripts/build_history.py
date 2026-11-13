#!/usr/bin/env python3
"""Keep a running history for the site: who's online over time, daily stat snapshots,
this week's gains (weekly challenges, Player of the Week) and past weekly champions.

The previous history.json is read from the live site, so nothing is stored in the repo.
"""
import argparse, json, os, sys
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Chicago")
TRACK = ["xp", "playtime_hours", "diamonds", "mob_kills", "blocks_placed", "blocks_mined", "deaths",
         "advancements", "villager_trades", "elytra_km", "fish_caught", "distance_km"]
# Weekly challenge pool: three are picked each week, rotating.
CHALLENGES = ["diamonds", "mob_kills", "blocks_placed", "playtime_hours", "blocks_mined",
              "villager_trades", "elytra_km", "advancements", "distance_km", "fish_caught"]


def load(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prev", default="")
    ap.add_argument("--lb", default="site/data/leaderboard.json")
    ap.add_argument("--status", default="status.json")
    ap.add_argument("--out", default="site/data/history.json")
    a = ap.parse_args()

    prev = load(a.prev, {}) if a.prev else {}
    lb = load(a.lb, {})
    status = load(a.status, {})
    players = lb.get("players") or []

    now = datetime.now(timezone.utc)
    local = now.astimezone(TZ)

    # Who's online over time (last 14 days)
    activity = prev.get("activity", [])
    if status:
        on = bool(status.get("online"))
        count = int(((status.get("players") or {}).get("online") or 0) if on else 0)
        activity.append({"t": now.isoformat(timespec="minutes"), "n": count, "on": on})
    cutoff = (now - timedelta(days=14)).isoformat()
    activity = [p for p in activity if p.get("t", "") >= cutoff]

    snapshots = prev.get("snapshots", {})
    week = prev.get("week")
    past = prev.get("past_weeks", [])
    week_start = (local.date() - timedelta(days=local.weekday())).isoformat()

    if players:
        cur = {p["uuid"]: dict({"name": p["name"]}, **{k: p.get(k, 0) for k in TRACK}) for p in players}
        today = local.date().isoformat()
        if today not in snapshots:
            snapshots[today] = cur
        keep_from = (local.date() - timedelta(days=40)).isoformat()
        snapshots = {d: v for d, v in snapshots.items() if d >= keep_from}

        # Archive last week's champion when a new week starts
        if week and week.get("start") != week_start and week.get("gains"):
            top = max(week["gains"], key=lambda g: g.get("xp", 0))
            if top.get("xp", 0) > 0:
                past.insert(0, {"start": week["start"], "champion": top["name"], "xp": top.get("xp", 0)})
            past = past[:8]

        base_date = min(d for d in snapshots if d >= week_start)
        base = snapshots[base_date]
        gains = []
        for uuid, c in cur.items():
            b = base.get(uuid, {})
            g = {"name": c["name"]}
            for k in TRACK:
                g[k] = max(0, round(c.get(k, 0) - b.get(k, 0), 1))
            gains.append(g)

        week_no = local.isocalendar()[1]
        picks = [CHALLENGES[(week_no * 3 + i) % len(CHALLENGES)] for i in range(3)]
        week = {"start": week_start, "since": base_date, "gains": gains, "challenges": picks}

    out = {
        "updated": now.isoformat(),
        "activity": activity,
        "snapshots": snapshots,
        "week": week,
        "past_weeks": past,
    }
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"History: {len(activity)} activity points, {len(snapshots)} snapshots, week of {week_start}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
