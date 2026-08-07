# -*- coding: utf-8 -*-
"""For every base, which emitted block ACTUALLY claims it under first-match-wins?

★ WHY THIS EXISTS. `audit_legacy.py` answers "is this base live in the game?". That is not
the question that decides whether there is work to do. A base can be perfectly live AND
already shown correctly, because something earlier in the filter matches it — and in this
tree that is usually a SUBSTRING rule:

    BaseType "Tattoo of"        catches all 53 tattoos in one line
    BaseType "Runegraft of"     catches every runegraft
    BaseType "Astrolabe"        catches every astrolabe

`base_mapping` still lists those bases under `_legacy`, so the audit reports them as
"live but in Legacy" — while on screen they are claimed by the substring rule that emits
first and never reach the Legacy block at all. The mapping is not the truth; emission order
is. So resolve against the generated filter and report the CLAIMANT.

Three outcomes, and only one is work:
    covered elsewhere -> nothing to do, the mapping entry is cosmetic
    claimed by Legacy -> real re-homing work
    claimed by nothing -> a coverage gap, worse than either
"""
import io, json, os, re, subprocess, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VERDICT = os.path.join(ROOT, "data", "from_ggg", "legacy_verdict.json")
OUT = os.path.join(ROOT, "data", "from_ggg", "legacy_claimants.json")


def blocks(path):
    """(header, command, body-lines) per emitted block; the `#==[` comments precede it."""
    out, pending = [], []
    lines = io.open(path, encoding="utf-8").read().split("\n")
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("#==["):
            pending.append(ln)
            i += 1
            continue
        m = re.match(r"^(Show|Hide|Minimal)\b", ln)
        if m:
            body = []
            i += 1
            while i < len(lines) and lines[i].startswith((" ", "\t")) and lines[i].strip():
                body.append(lines[i].strip())
                i += 1
            out.append((pending[-1] if pending else "", m.group(1), body))
            pending = []
            continue
        i += 1
    return out


def matchers(body):
    """-> (exact_names, substrings, class_names or None)"""
    ex, sub, cls = [], [], None
    for ln in body:
        m = re.match(r"BaseType\s+(==\s*)?(.*)$", ln)
        if m:
            names = re.findall(r'"([^"]+)"', m.group(2))
            (ex if m.group(1) else sub).extend(names)
        m = re.match(r"Class\s+(==\s*)?(.*)$", ln)
        if m:
            cls = re.findall(r'"([^"]+)"', m.group(2)) or cls
    return ex, sub, cls


def main():
    filt = os.path.join(ROOT, "out", "audit.filter")
    os.makedirs(os.path.dirname(filt), exist_ok=True)
    subprocess.run([("npx.cmd" if os.name == "nt" else "npx"), "--no-install", "node",
                    os.path.join(ROOT, "filter_generation", "generate.mjs"), "--out", filt],
                   cwd=ROOT, check=False, capture_output=True)
    if not os.path.exists(filt):
        subprocess.run(["node", os.path.join(ROOT, "filter_generation", "generate.mjs"),
                        "--out", filt], cwd=ROOT, check=True)

    bs = blocks(filt)
    # class of each base, for the Class-net fallback
    bt = json.load(io.open(os.path.join(
        ROOT, "data", "source", "3.29.0.4.2", "tables", "English", "BaseItemTypes.json"),
        encoding="utf-8"))
    ic = json.load(io.open(os.path.join(
        ROOT, "data", "source", "3.29.0.4.2", "tables", "English", "ItemClasses.json"),
        encoding="utf-8"))
    cn = {i: r.get("Name") for i, r in enumerate(ic)}
    CLS = {}
    for r in bt:
        if r.get("Name") and r["Name"] not in CLS:
            CLS[r["Name"]] = cn.get(r.get("ItemClassesKey"), "?")

    pre = [(h, c, matchers(b)) for h, c, b in bs]

    def claim(name):
        for h, cmd, (ex, sub, cls) in pre:
            if cls and CLS.get(name) not in cls:
                continue
            if name in ex or any(p in name for p in sub):
                return h, cmd, ("exact" if name in ex else "substring")
            if cls and not ex and not sub:
                return h, cmd, "class net"
        return "", "", "none"

    verdict = json.load(io.open(VERDICT, encoding="utf-8"))
    live = {k: v for k, v in verdict.items() if v["verdict"].startswith("LIVE")}

    rows, buckets = {}, collections.Counter()
    for n in sorted(live):
        h, cmd, how = claim(n)
        m = re.match(r"#==\[(\d+)\]-\s*(.*?)\s*==$", h)
        label = m.group(2) if m else "(nothing)"
        is_legacy = "Legacy" in label or "遗留" in label or "legacy" in label.lower()
        state = ("GAP — nothing shows it" if how == "none"
                 else "needs re-homing" if is_legacy
                 else "covered by " + how)
        buckets[state] += 1
        rows[n] = {"class": CLS.get(n), "claimed_by": label, "how": how,
                   "state": state, "added": live[n]["verdict"].replace("LIVE since ", "")}

    print("158-row live set, resolved against the EMITTED filter:\n")
    for k, c in buckets.most_common():
        print("   %-28s %4d" % (k, c))

    for state in ("needs re-homing", "GAP — nothing shows it"):
        sel = {n: r for n, r in rows.items() if r["state"] == state}
        if not sel:
            continue
        print("\n★ %s (%d)" % (state.upper(), len(sel)))
        by = collections.defaultdict(list)
        for n, r in sel.items():
            by[r["class"]].append(n)
        for c in sorted(by):
            print("   %-26s %3d   %s" % (c, len(by[c]), ", ".join(sorted(by[c])[:6])
                                         + (" …" if len(by[c]) > 6 else "")))

    covered = {n: r for n, r in rows.items() if r["state"].startswith("covered")}
    print("\ncovered already — the claimants doing the work:")
    for lbl, c in collections.Counter(r["claimed_by"] for r in covered.values()).most_common(12):
        print("   x%-4d %s" % (c, lbl[:88]))

    json.dump(rows, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\nwrote %s" % os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
