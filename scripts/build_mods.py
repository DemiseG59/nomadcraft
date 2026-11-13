#!/usr/bin/env python3
"""Build site/data/mods.json from the server's mods folder.

plan:  compare the server's file list with the live mods.json and write lftp "get"
       commands for only the new jars.
build: read names/descriptions from the downloaded jars and write mods.json.
"""
import argparse, hashlib, json, os, re, sys, urllib.parse, urllib.request, zipfile
from datetime import datetime, timezone

REMOTE = "profile_yhsfd/mods/"


def load(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def read_list(path):
    names = []
    try:
        for line in open(path, encoding="utf-8", errors="replace"):
            n = os.path.basename(line.strip().rstrip("/"))
            if n.lower().endswith(".jar"):
                names.append(n)
    except Exception:
        pass
    return sorted(set(names))


def pretty_from_file(fn):
    base = fn[:-4]
    parts = re.split(r"[-_+ ]", base)
    words = []
    for p in parts:
        if not p:
            continue
        if re.match(r"^(v?\d|mc\d|fabric$|neoforge$|forge$|quilt$)", p, re.I):
            break
        words.append(p)
    name = " ".join(words) or base
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name).strip().title() if name.islower() else name


def clean(s, n=220):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    if "${" in s:
        return ""
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def parse_jar(path, fn):
    info = {"file": fn, "name": pretty_from_file(fn), "description": "", "version": "", "authors": "", "url": ""}
    try:
        with zipfile.ZipFile(path) as z:
            names = set(z.namelist())
            meta = None
            for cand in ("fabric.mod.json", "quilt.mod.json"):
                if cand in names:
                    meta = json.loads(z.read(cand).decode("utf-8", "replace"), strict=False)
                    if cand == "quilt.mod.json":
                        meta = (meta.get("quilt_loader") or {}) | (meta.get("quilt_loader", {}).get("metadata") or {})
                    break
            if meta:
                info["name"] = clean(meta.get("name") or info["name"], 80) or info["name"]
                info["description"] = clean(meta.get("description"))
                info["version"] = clean(meta.get("version"), 40)
                auth = meta.get("authors") or meta.get("contributors") or []
                if isinstance(auth, dict):
                    auth = list(auth.keys())
                info["authors"] = clean(", ".join(a.get("name", "") if isinstance(a, dict) else str(a) for a in auth[:3]), 80)
                contact = meta.get("contact") or {}
                url = contact.get("homepage") or contact.get("sources") or ""
                info["url"] = url if str(url).startswith("http") else ""
            else:
                for cand in ("META-INF/neoforge.mods.toml", "META-INF/mods.toml"):
                    if cand in names:
                        t = z.read(cand).decode("utf-8", "replace")
                        m = re.search(r'displayName\s*=\s*"([^"]+)"', t)
                        if m:
                            info["name"] = clean(m.group(1), 80)
                        m = re.search(r"description\s*=\s*'''(.*?)'''", t, re.S) or re.search(r'description\s*=\s*"([^"]+)"', t)
                        if m:
                            info["description"] = clean(m.group(1))
                        break
    except Exception as e:
        print(f"Couldn't read {fn}: {e}")
    return info


UA = {"User-Agent": "DemiseG59/nomadcraft-site (GitHub Pages stats site)", "Content-Type": "application/json"}


def sha1(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def http_json(url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=UA, method="POST" if data else "GET")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def link_modrinth(mods_by_hash):
    """Match jars to Modrinth projects by file hash. Fills url/icon/source in place."""
    if not mods_by_hash:
        return
    try:
        versions = http_json("https://api.modrinth.com/v2/version_files", {"hashes": list(mods_by_hash), "algorithm": "sha1"})
        pid_for = {h: v.get("project_id") for h, v in versions.items() if v.get("project_id")}
        ids = sorted(set(pid_for.values()))
        projects = {}
        for i in range(0, len(ids), 100):
            q = urllib.parse.quote(json.dumps(ids[i:i + 100]))
            for pr in http_json("https://api.modrinth.com/v2/projects?ids=" + q):
                projects[pr["id"]] = pr
        for h, m in mods_by_hash.items():
            pr = projects.get(pid_for.get(h, ""))
            if not pr:
                continue
            m["url"] = "https://modrinth.com/%s/%s" % (pr.get("project_type") or "mod", pr.get("slug") or pr["id"])
            m["icon"] = pr.get("icon_url") or ""
            m["source"] = "modrinth"
            if not m.get("description"):
                m["description"] = clean(pr.get("description"))
        print(f"Matched {sum(1 for m in mods_by_hash.values() if m.get('source') == 'modrinth')} of {len(mods_by_hash)} new mods on Modrinth.")
    except Exception as e:
        print(f"Modrinth lookup failed: {e}")


def finish_links(m):
    if m.get("source") == "modrinth":
        return
    m["source"] = "curseforge"
    m["url"] = "https://www.curseforge.com/minecraft/search?class=mc-mods&search=" + urllib.parse.quote(m.get("name") or m["file"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["plan", "build"])
    ap.add_argument("--list", default="mods_list.txt")
    ap.add_argument("--prev", default="prev/mods.json")
    ap.add_argument("--jars", default="mods_new")
    ap.add_argument("--cmds", default="get_mods.lftp")
    ap.add_argument("--out", default="site/data/mods.json")
    a = ap.parse_args()

    files = read_list(a.list)
    prev = load(a.prev, {})
    known = {m["file"]: m for m in prev.get("mods", []) if m.get("file")}

    if a.mode == "plan":
        need = [f for f in files if f not in known]
        os.makedirs(a.jars, exist_ok=True)
        with open(a.cmds, "w", encoding="utf-8") as f:
            for fn in need:
                f.write(f'get -O {a.jars} "{REMOTE}{fn}"\n')
        print(f"{len(files)} mods on the server, {len(need)} new to read.")
        return 0

    if not files:
        if prev.get("mods"):
            os.makedirs(os.path.dirname(a.out), exist_ok=True)
            with open(a.out, "w", encoding="utf-8") as f:
                json.dump(prev, f, separators=(",", ":"))
            print("Mod list unavailable; reusing the live one.")
        return 0

    mods, by_hash = [], {}
    for fn in files:
        if fn in known:
            mods.append(known[fn])
            continue
        path = os.path.join(a.jars, fn)
        if os.path.exists(path):
            m = parse_jar(path, fn)
            m["homepage"] = m.pop("url", "")
            try:
                by_hash[sha1(path)] = m
            except Exception:
                pass
        else:
            m = {"file": fn, "name": pretty_from_file(fn), "description": "", "version": "", "authors": ""}
        mods.append(m)
    link_modrinth(by_hash)
    for m in mods:
        finish_links(m)
    mods.sort(key=lambda m: m["name"].lower())
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"updated": datetime.now(timezone.utc).isoformat(), "count": len(mods), "mods": mods}, f, separators=(",", ":"))
    print(f"Wrote {len(mods)} mods to {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
