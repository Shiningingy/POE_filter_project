"""Read a generation trace and answer what `mapping` alone cannot.

⚠️ BROKEN RIGHT NOW — raises `KeyError: 'tiers'`. Not this file's fault, and not a reason
to delete it: `generate.mjs --trace` (the Node CLI that replaced `generate.py --trace` in
ADR-0007) emits only the `blocks` half of the trace. The `tiers` half — every tier
CONSIDERED, with `{file, emitted, reason, mapped_items}` — is no longer produced, and that
is the half that answers "which tiers carried mapped items and emitted nothing?".

To revive: add an `onTier` observer to `GeneratorData` in filterGenerator.ts, symmetric
with the existing `onBlock`, and have generate.mjs write `{blocks, tiers, meta}` again.
Queued with workstream C, which is what needs it. See
filter_generation/archive/retired-code/README.md.

Usage:  python filter_generation/analyze_trace.py [traces/ruthless-soft.json ...]

The theme-pipeline rewrite migrates each category from what its blocks ACTUALLY
claimed under the current engine, not from its `mapping`. This script is the
proof that the trace supports that, and the prototype of the derived index that
replaces `base_mapping` (workstream C).

It reports, per trace:

  * CLAIMED-NOT-MAPPED — bases a block emitted that the category's `mapping`
    never listed. These come from `tier + targets` rules, which do not intersect
    pending_items. Every one of them would be LOST by a mapping-driven migration.
  * MAPPED-NOT-CLAIMED — items `mapping` assigned to a tier that reached no
    block at all. The recurring "mapped but emits nothing" bug, made visible.
  * SHADOWED — a base whose later claim is genuinely unreachable.

    ⚠️ This is NOT simply "claimed twice, earliest wins". Naming the same base in
    several blocks is the NORMAL, correct pattern here: Opal Ring is claimed 8
    times, each behind a different gate (Quality > 20, MemoryStrands >= 1,
    ItemLevel >= 86 / >= 84, AreaLevel >= 68 + Rarity Rare). Those are the
    deliberate precision layers of ADR-0006 and every one of them is live.

    A later claim is dead only when an EARLIER block would already have caught
    everything it can match — i.e. the earlier block's condition set is a subset
    of the later one's, so it is at least as permissive. Subset on emitted
    condition lines is conservative: it can miss a dead block (two spellings of
    the same gate), never invent one.

    Consequence for the design: `wins` is NOT derivable from generation order
    plus base lists, as docs/design/theme-pipeline-rewrite.md currently states.
    Conditions decide it. The index must carry them.
  * CONDITION-ONLY BLOCKS — class_condition and self-selecting blocks, which
    emit no BaseType line. Their claim is not expressible as a base list, so
    they must migrate as rules carrying their conditions verbatim.
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
BASE_MAPPING_DIR = PROJECT_ROOT / "filter_generation" / "data" / "base_mapping"


_STYLE_STARTS = ("Show", "Hide", "Minimal", "Set", "Play", "Minimap", "Custom", "DisableDropSound")


def conditions_of(block):
    """The block's MATCHING lines, minus its own BaseType line.

    BaseType is excluded because it is what we are keying on; what matters for
    reachability is the extra gates a block puts in front of that base.
    """
    return frozenset(
        line.strip() for line in block["text"].split("\n")
        if line.strip() and not line.strip().startswith(_STYLE_STARTS)
        and not line.strip().startswith("BaseType")
    )


def load_doc(rel_file):
    path = BASE_MAPPING_DIR / rel_file
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def load_mapping(rel_file):
    """The authored base -> tier map for one category file."""
    out = defaultdict(set)
    for base, tiers in load_doc(rel_file).get("mapping", {}).items():
        for t in (tiers if isinstance(tiers, list) else [tiers]):
            out[base].add(t)
    return out


def silent_rules(blocks, tiers):
    """Authored rules that emitted NO block anywhere in their file.

    The second index axis. A rule can be perfectly well-formed JSON, appear in the
    editor, and produce nothing: `Class ==` is exact and class names are plural
    ("Blueprints", not "Blueprint"); a rule with conditions but no tier is skipped
    outright; an earlier rule can steal every one of its targets via pending_items.
    None of that is visible today — the rule simply sits there looking fine.

    `disabled: true` rules are excluded: those are off on purpose. So are rules the
    campaign picker explains — an unpicked weapon group takes its rules down with
    it, and that is the selection-centric ladder working, not a defect.

    That exclusion is decided PER RULE, not per file: a rule is campaign-explained
    when every tier it could have attached to was gated. `_campaign/20 Armour
    Progression.json` is why the coarser file-level test is not enough — it has
    live tiers alongside gated ones, so judging by file called a dozen working
    rules broken.
    """
    emitted = defaultdict(set)
    for b in blocks:
        if b.get("rule_authored") and b.get("rule_index") is not None:
            emitted[b["file"]].add(b["rule_index"])

    gated_keys = defaultdict(set)
    for t in tiers:
        if not t["emitted"] and t["reason"].startswith("campaign:"):
            gated_keys[t["file"]].add(t["tier_key"])

    out, gated = [], []
    for rel_file in sorted({t["file"] for t in tiers}):
        doc = load_doc(rel_file)
        mapping = load_mapping(rel_file)
        for i, rule in enumerate(doc.get("rules", [])):
            if rule.get("disabled") or i in emitted[rel_file]:
                continue

            # Which tiers could this rule ever have emitted under? An explicit
            # overrides.Tier names one; otherwise it rides the tiers its targets
            # are mapped to.
            tier_override = (rule.get("overrides") or {}).get("Tier")
            if tier_override:
                reachable_tiers = {tier_override} if isinstance(tier_override, str) else set(tier_override)
            else:
                reachable_tiers = set()
                for tgt in rule.get("targets") or []:
                    reachable_tiers |= mapping.get(tgt, set())

            label = (rule.get("localization", {}) or {}).get("ch") or rule.get("comment") or f"rule #{i}"
            rec = {
                "file": rel_file, "rule_index": i, "label": label,
                "targets": len(rule.get("targets") or []),
                "tier": tier_override,
                "conditions": sorted((rule.get("conditions") or {}).keys()),
            }
            explained = reachable_tiers and reachable_tiers <= gated_keys[rel_file]
            (gated if explained else out).append(rec)
    return out, gated


def analyze(trace_path):
    trace = json.loads(Path(trace_path).read_text(encoding="utf-8"))
    blocks, tiers = trace["blocks"], trace["tiers"]
    meta = trace["meta"]

    print(f"\n{'=' * 78}\n{trace_path}")
    print(f"  mode={meta['mode']}  strictness={meta['strictness']}  "
          f"{meta['blocks']} blocks, {meta['tiers']} tiers considered")

    # --- the derived index: base -> every occurrence, in emission order --------
    index = defaultdict(list)
    for b in sorted(blocks, key=lambda x: x["order"]):
        b["_conds"] = conditions_of(b)
        for base in b["bases"]:
            index[base].append(b)

    multi = {base: occ for base, occ in index.items() if len(occ) > 1}
    # Dead = some earlier block is at least as permissive (its conditions are a
    # subset of this one's), so nothing can ever reach this block.
    shadowed = {}
    for base, occ in multi.items():
        dead = []
        for i, later in enumerate(occ):
            for earlier in occ[:i]:
                if earlier["_conds"] <= later["_conds"]:
                    dead.append((earlier, later))
                    break
        if dead:
            shadowed[base] = dead
    dead_occurrences = sum(len(d) for d in shadowed.values())

    # --- what each side knows -------------------------------------------------
    claimed_by_file = defaultdict(set)
    for b in blocks:
        claimed_by_file[b["file"]].update(b["bases"])

    claimed_not_mapped = defaultdict(set)
    mapped_not_claimed = defaultdict(set)
    for rel_file, claimed in claimed_by_file.items():
        mapping = load_mapping(rel_file)
        extra = claimed - set(mapping)
        if extra:
            claimed_not_mapped[rel_file] = extra

    # A tier that emitted nothing takes its mapped items down with it, but so
    # does a rule that stole them; compare per FILE against everything claimed.
    #
    # Split out the campaign gate first. An unpicked weapon/armour group emitting
    # nothing is the selection-centric ladder working as designed, not a gap —
    # and it is the overwhelming majority, so folding it in would bury the few
    # cases that are actually unexplained.
    gated_by_campaign = defaultdict(set)
    for t in tiers:
        if not t["emitted"] and t["reason"].startswith("campaign:"):
            gated_by_campaign[t["file"]].update(t["mapped_items"])

    for rel_file in {t["file"] for t in tiers}:
        mapping = load_mapping(rel_file)
        missing = set(mapping) - claimed_by_file.get(rel_file, set())
        missing -= gated_by_campaign.get(rel_file, set())
        if missing:
            mapped_not_claimed[rel_file] = missing

    silent_tiers = [t for t in tiers if not t["emitted"]]
    reasons = defaultdict(int)
    for t in silent_tiers:
        reasons[t["reason"]] += 1
    # A silent tier that carried items is the damaging case: those items were
    # assigned somewhere and then went nowhere.
    silent_with_items = [t for t in silent_tiers if t["mapped_items"]]

    cond_only = [b for b in blocks if not b["bases"]]

    print(f"\n  CLAIMED-NOT-MAPPED   {sum(len(v) for v in claimed_not_mapped.values()):>5} bases "
          f"in {len(claimed_not_mapped)} files  (a mapping-driven migration loses these)")
    for f, bases in sorted(claimed_not_mapped.items())[:6]:
        print(f"      {f}: {len(bases)}  e.g. {sorted(bases)[:3]}")

    print(f"\n  MAPPED-NOT-CLAIMED   {sum(len(v) for v in mapped_not_claimed.values()):>5} bases "
          f"in {len(mapped_not_claimed)} files  (mapped, emits nothing, NOT campaign-gated)")
    for f, bases in sorted(mapped_not_claimed.items(), key=lambda kv: -len(kv[1]))[:6]:
        print(f"      {f}: {len(bases)}  e.g. {sorted(bases)[:3]}")
    print(f"      (+{sum(len(v) for v in gated_by_campaign.values())} campaign-gated, working as designed)")

    print(f"\n  MULTI-CLAIMED        {len(multi):>5} bases named by more than one block "
          f"(normal — precision layers)")
    # Per BASE, not per block: the later block usually still emits for the other
    # bases it names. It is this base's claim on it that can never be reached.
    print(f"  SHADOWED             {len(shadowed):>5} bases with a genuinely unreachable claim "
          f"({dead_occurrences} dead claims)")
    for base, dead in sorted(shadowed.items(), key=lambda kv: -len(kv[1]))[:8]:
        earlier, later = dead[0]
        print(f"      {base}: its claim in [{later['order']}] {later['file']} "
              f"{later['tier_key']} never fires — [{earlier['order']}] {earlier['tier_key']} "
              f"({earlier['source']}) already took it")

    print(f"\n  CONDITION-ONLY       {len(cond_only):>5} blocks emit no BaseType line "
          f"(must migrate as rules)")
    by_source = defaultdict(int)
    for b in cond_only:
        by_source[b["source"]] += 1
    for src, n in sorted(by_source.items()):
        print(f"      {src}: {n}")

    print(f"\n  SILENT TIERS         {len(silent_tiers):>5} emitted nothing "
          f"({len(silent_with_items)} of them carried mapped items)")
    for reason, n in sorted(reasons.items(), key=lambda kv: -kv[1]):
        print(f"      {reason}: {n}")

    quiet, quiet_gated = silent_rules(blocks, tiers)
    print(f"\n  SILENT RULES         {len(quiet):>5} authored rules emitted NOTHING "
          f"(not disabled, not campaign-gated)")
    for r in quiet[:12]:
        why = []
        if not r["targets"] and not r["conditions"]:
            why.append("no targets, no conditions")
        if r["tier"] is None and not r["targets"]:
            why.append("no tier to attach to")
        print(f"      {r['file']} #{r['rule_index']} {r['label']!r}"
              f" targets={r['targets']} tier={r['tier']!r}"
              f"{'  <- ' + '; '.join(why) if why else ''}")
    if len(quiet) > 12:
        print(f"      … +{len(quiet) - 12} more")
    print(f"      (+{len(quiet_gated)} whose every reachable tier is campaign-gated, working as designed)")

    return {
        "silent_rules": quiet,
        "trace": str(trace_path),
        "index_size": len(index),
        "claimed_not_mapped": {f: sorted(v) for f, v in claimed_not_mapped.items()},
        "mapped_not_claimed": {f: sorted(v) for f, v in mapped_not_claimed.items()},
        "shadowed": {b: [{"dead": {k: later[k] for k in ("order", "file", "tier_key", "source", "rule")},
                          "behind": {k: earlier[k] for k in ("order", "file", "tier_key", "source", "rule")}}
                         for earlier, later in dead] for b, dead in shadowed.items()},
    }


def write_index(trace_path, out_dir):
    """The derived index: base -> every occurrence, in emission order.

    The inverse of `mapping`, and the artifact that replaces it (workstream C).
    `mapping` is forward and authored ("Chaos Orb" -> "Tier 3 General"); this is
    reverse and derived, so it can answer what nobody can see today: where does
    this base appear, and can each of those claims actually fire?

    ⚠️ Mode-specific. `excluded_modes` gives ruthless and standard different block
    sets, so an occurrence list is only meaningful for the mode it was built from —
    hence one file per mode.

    `reachable` is deliberately NOT "wins". Which block catches a given drop
    depends on the ITEM (an Opal Ring at ilvl 84 with Quality 21 lands somewhere
    different from the same base at Quality 0), and the drop simulator already
    answers that. This answers only the static half: is there an earlier claim at
    least as permissive, making this one dead?
    """
    trace = json.loads(Path(trace_path).read_text(encoding="utf-8"))
    mode = trace["meta"]["mode"]
    blocks = sorted(trace["blocks"], key=lambda x: x["order"])
    for b in blocks:
        b["_conds"] = conditions_of(b)

    index = defaultdict(list)
    for b in blocks:
        for base in b["bases"]:
            prior = index[base]
            reachable = not any(p["_conditions"] <= set(b["_conds"]) for p in prior)
            prior.append({
                "order": b["order"], "file": b["file"], "block": b["tier_key"],
                "rule": b["rule"], "source": b["source"], "hide": b["is_hide"],
                "conditions": sorted(b["_conds"]),
                "reachable": reachable,
                "_conditions": set(b["_conds"]),
            })

    out = {base: [{k: v for k, v in occ.items() if k != "_conditions"} for occ in occs]
           for base, occs in sorted(index.items())}
    path = out_dir / f"index-{mode}.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    unreachable = sum(1 for occs in out.values() for o in occs if not o["reachable"])
    print(f"[OK] Index ({mode}): {len(out)} bases, "
          f"{sum(len(v) for v in out.values())} occurrences, {unreachable} unreachable -> {path.name}")


def main():
    traces_dir = PROJECT_ROOT / "filter_generation" / "traces"
    args = sys.argv[1:] or [str(p) for p in sorted(traces_dir.glob("*.json"))
                            if not p.name.startswith(("analysis", "index"))]
    reports = [analyze(a) for a in args]
    out = traces_dir / "analysis.json"
    out.write_text(json.dumps(reports, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n[OK] Detail written to {out}")
    for a in args:
        write_index(a, traces_dir)


if __name__ == "__main__":
    main()
