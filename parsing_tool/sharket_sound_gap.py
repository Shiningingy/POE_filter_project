# -*- coding: utf-8 -*-
"""Which per-item sounds does the Sharket filter give that ours does not?

★ THE MECHANISM DIFFERS AND THAT IS THE WHOLE JOB. Sharket names an item's sound with a
SUBSTRING BaseType (`BaseType "Chaos Orb"`, no `==`) — 415 of their 666 sound-carrying
blocks, and not one exact dedicated sound. We use `BaseType ==` throughout. So a faithful
comparison is not a diff of two name lists: each pattern has to be EXPANDED against GGPK to
the bases it really catches, in file order, because first-match-wins means an earlier block
already took the overlap (`Tainted Chaos Orb` belongs to 污秽混沌石.mp3, and only what is
left reaches `Chaos Orb` -> 混沌石.mp3).

A sound naming more than DEDICATED_MAX bases is a TIER sound, not an item sound, and is out
of scope — those are the author's own call.

Every row also carries the GGG feed's verdict, because a sound for a retired base is work
that should not be done: Sharket still carries sounds for the four Guardian maps, which 3.28
removed.
"""
import io, json, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEIRS = os.path.join(ROOT, "test", "Sharket3.28无情_临时工版.ruthlessfilter")
OURS = os.path.join(ROOT, "out", "audit.filter")      # who_claims.py regenerates this
OUT_MD = os.path.join(ROOT, "docs", "sharket-sound-gap.md")
DEDICATED_MAX = 3

NON_EQUIPMENT = {"Map Fragments", "Misc Map Items", "Maps", "Quest Items", "Support Gems",
                 "Skill Gems", "Stackable Currency", "Divination Cards", "Breachstones",
                 "Vault Keys", "Delve Socketable Currency", "Incubators", "Corpses"}


def parse(path):
    txt = io.open(path, encoding="utf-8", errors="replace").read()
    out, cur = [], None
    for ln in txt.split("\n"):
        s = ln.strip()
        if re.match(r"^(Show|Hide|Minimal)\b", s):
            if cur:
                out.append(cur)
            cur = {"sound": None, "vol": None, "exact": [], "substr": [], "cls": None, "hdr": ""}
            continue
        if cur is None:
            continue
        if s.startswith("#==["):
            cur["hdr"] = s
            continue
        if not s or s.startswith("#"):
            continue
        m = re.match(r'CustomAlertSound\s+"([^"]+)"\s*(\d+)?', s)
        if m:
            cur["sound"] = os.path.basename(m.group(1).replace("\\", "/"))
            cur["vol"] = m.group(2)
        m = re.match(r"BaseType\s+(==\s*)?(.*)$", s)
        if m:
            names = re.findall(r'"([^"]+)"', m.group(2))
            (cur["exact"] if m.group(1) else cur["substr"]).extend(names)
        if s.startswith("Class"):
            cur["cls"] = re.findall(r'"([^"]+)"', s) or None
    if cur:
        out.append(cur)
    return out


def main():
    bt = json.load(io.open(os.path.join(ROOT, "data", "source", "3.29.0.4.2", "tables",
                                        "English", "BaseItemTypes.json"), encoding="utf-8"))
    ic = json.load(io.open(os.path.join(ROOT, "data", "source", "3.29.0.4.2", "tables",
                                        "English", "ItemClasses.json"), encoding="utf-8"))
    cnm = {i: r.get("Name") for i, r in enumerate(ic)}
    CLS, NAMES = {}, []
    for r in bt:
        n = r.get("Name")
        if n and n not in CLS:
            CLS[n] = cnm.get(r.get("ItemClassesKey"), "?")
            NAMES.append(n)

    cnp = os.path.join(ROOT, "data", "source", "cn-3.29", "tables",
                       "Simplified Chinese", "BaseItemTypes.json")
    cn = json.load(io.open(cnp, encoding="utf-8")) if os.path.exists(cnp) else []
    zid = {r.get("Id"): r.get("Name") for r in cn if r.get("Id")}
    ids = collections.defaultdict(list)
    for r in bt:
        if r.get("Name"):
            ids[r["Name"]].append(r.get("Id"))

    def zh(n):
        g = [zid.get(i) for i in ids.get(n, []) if zid.get(i)]
        return g[0] if g else ""

    FEED = os.path.join(ROOT, "data", "from_ggg", "threads")
    feed = {f[:-5]: json.load(io.open(os.path.join(FEED, f), encoding="utf-8"))
            for f in os.listdir(FEED) if f.endswith(".json")}
    VER = sorted(feed, key=lambda s: tuple(int(x) for x in re.findall(r"\d+", s)), reverse=True)

    def event(n):
        k = n.casefold()
        for v in VER:
            for sec, ev in (("removed_items", "⚠️ RETIRED"), ("new_items", "live"),
                            ("returning_items", "live")):
                if any(x.casefold() == k for x in feed[v].get(sec, [])):
                    return "%s %s" % (ev, v)
        return "—"

    def claimed(blocks):
        got = {}
        for b in blocks:
            if not (b["exact"] or b["substr"]):
                continue
            for n in NAMES:
                if n in got or (b["cls"] and CLS.get(n) not in b["cls"]):
                    continue
                if n in b["exact"] or any(p in n for p in b["substr"]):
                    got[n] = (b["sound"], b["vol"], b["hdr"])
        return got

    T, O = claimed(parse(THEIRS)), claimed(parse(OURS))
    fan = collections.Counter(v[0] for v in T.values() if v[0])
    gap = {n: (v, O.get(n)) for n, v in T.items()
           if v[0] and fan[v[0]] <= DEDICATED_MAX and (not O.get(n) or O[n][0] != v[0])}
    sel = {n: v for n, v in gap.items() if CLS.get(n) in NON_EQUIPMENT}

    snd_dir = os.path.join(ROOT, "sound_files", "Sharket掉落音效")
    onfile = set(os.listdir(snd_dir)) if os.path.isdir(snd_dir) else set()

    by = collections.defaultdict(list)
    for n, (t, o) in sel.items():
        by[CLS.get(n)].append((n, t, o))

    md = ["# Sharket per-item sounds we do not match — non-equipment",
          "",
          "**%d bases.** Sharket gives each a DEDICATED sound (one naming ≤%d bases); we play"
          " something else or nothing." % (len(sel), DEDICATED_MAX),
          "",
          "★ Check the **status** column first. Sharket's filter is a 3.28 snapshot, so it still"
          " carries sounds for bases GGG has since retired — those are work that should not be"
          " done. `—` means no thread in `data/from_ggg/threads/` names the base either way.",
          "",
          "`file?` is whether the mp3 is already in `sound_files/Sharket掉落音效/`.",
          ""]
    for c in sorted(by, key=lambda c: -len(by[c])):
        md += ["## %s — %d" % (c, len(by[c])), "",
               "| base | zh | their sound | file? | we play now | status |",
               "|---|---|---|---|---|---|"]
        for n, t, o in sorted(by[c]):
            now = (o[0] if o else None) or "*nothing*"
            md.append("| %s | %s | `%s` @%s | %s | %s | %s |"
                      % (n, zh(n), t[0], t[1] or "?",
                         "yes" if t[0] in onfile else "**NO**", now, event(n)))
        md.append("")

    io.open(OUT_MD, "w", encoding="utf-8").write("\n".join(md) + "\n")
    print("wrote %s  (%d bases)" % (os.path.relpath(OUT_MD, ROOT), len(sel)))
    retired = [n for n in sel if event(n).startswith("⚠️")]
    print("of which RETIRED by the feed (do not port): %d  %s" % (len(retired), sorted(retired)))
    missing = {t[0] for n, (t, o) in sel.items() if t[0] not in onfile}
    print("sound files missing from disk: %d %s" % (len(missing), sorted(missing)))


if __name__ == "__main__":
    main()
