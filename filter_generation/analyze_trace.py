"""Read a generation trace and answer what `mapping` alone cannot.

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


def load_mapping(rel_file):
    """The authored base -> tier map for one category file."""
    path = BASE_MAPPING_DIR / rel_file
    if not path.is_file():
        return {}
    doc = json.loads(path.read_text(encoding="utf-8"))
    out = defaultdict(set)
    for base, tiers in doc.get("mapping", {}).items():
        for t in (tiers if isinstance(tiers, list) else [tiers]):
            out[base].add(t)
    return out


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

    return {
        "trace": str(trace_path),
        "index_size": len(index),
        "claimed_not_mapped": {f: sorted(v) for f, v in claimed_not_mapped.items()},
        "mapped_not_claimed": {f: sorted(v) for f, v in mapped_not_claimed.items()},
        "shadowed": {b: [{"dead": {k: later[k] for k in ("order", "file", "tier_key", "source", "rule")},
                          "behind": {k: earlier[k] for k in ("order", "file", "tier_key", "source", "rule")}}
                         for earlier, later in dead] for b, dead in shadowed.items()},
    }


def main():
    args = sys.argv[1:] or [str(p) for p in
                            sorted((PROJECT_ROOT / "filter_generation" / "traces").glob("*.json"))
                            if not p.name.startswith("analysis")]
    reports = [analyze(a) for a in args]
    out = PROJECT_ROOT / "filter_generation" / "traces" / "analysis.json"
    out.write_text(json.dumps(reports, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n[OK] Detail written to {out}")


if __name__ == "__main__":
    main()
