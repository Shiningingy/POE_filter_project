"""One-shot: turn auto-sound's global table into explicit per-occurrence card overrides.

Usage:  python filter_generation/migrate_item_overrides.py [--check]

Step C of the theme-pipeline rewrite. Auto-sound is deleted; a per-item sound
becomes an override on the item CARD, which is the per-occurrence representation
of a base in the editor.

Where the override lives: `tier_definition[category][tier]["item_overrides"][base]`.
One home, keyed by (tier, base), because within a tier a base is claimed by exactly
one emitted block — `pending_items` guarantees it — so that key identifies the
occurrence whether the block came from a rule or from the tier's own base list.
It sits on the tier because that is the block you see in the editor.

What it replaces, and why the replacement is not like-for-like:

    already_handled = any(item_name in r.get("targets", []) for r in all_rules)

Auto-sound skipped a base if ANY rule in the file merely NAMED it — not if that
rule set a sound, just if it mentioned the base. So one rule written for an
unrelated purpose silenced the item across its whole file, including tiers no
rule touches. Nine curated sounds reach the game nowhere at all because of it,
Chaos Orb among them, silenced by a `StackSize >= 10` stack tier-up that cannot
even fire in Ruthless.

This migration therefore restores the DOCUMENTED intent of basetype_sounds — "a
base type with an entry gets a per-item sound in every category that carries it"
— by writing the override at every occurrence, and it is explicit data afterwards,
so any occurrence you do not want is deleted rather than suppressed by a lever.

`suppress_basetype_sounds` files are left silent, preserving today's behaviour;
the flag itself is retired once this lands.

Reads the traces (both modes, unioned) because only they know which block actually
claimed which base — `mapping` cannot tell you, as 61 bases are emitted by rules
that never appear in it.
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
DATA = PROJECT_ROOT / "filter_generation" / "data"
TIER_DEF_DIR = DATA / "tier_definition"
BASE_MAPPING_DIR = DATA / "base_mapping"
TRACES = PROJECT_ROOT / "filter_generation" / "traces"
SOUND_MAP = DATA / "theme" / "sharket" / "Sharket_sound_map.json"


def collect():
    """(file, tier) -> {base: sound pair}, unioned across modes."""
    bt = json.loads(SOUND_MAP.read_text(encoding="utf-8")).get("basetype_sounds", {})

    suppressed = set()
    for p in BASE_MAPPING_DIR.rglob("*.json"):
        doc = json.loads(p.read_text(encoding="utf-8"))
        if doc.get("_meta", {}).get("suppress_basetype_sounds"):
            suppressed.add(p.relative_to(BASE_MAPPING_DIR).as_posix())

    wanted = defaultdict(dict)
    for trace_file in sorted(TRACES.glob("*-soft.json")):
        trace = json.loads(trace_file.read_text(encoding="utf-8"))
        for b in trace["blocks"]:
            if b["file"] in suppressed:
                continue
            for base in b["bases"]:
                s = bt.get(base)
                if s:
                    wanted[(b["file"], b["tier_key"])][base] = [s["file"], s["volume"]]
    return wanted, len(bt), len(suppressed)


def migrate(check_only: bool) -> None:
    wanted, n_sounds, n_suppressed = collect()

    by_file = defaultdict(dict)
    for (rel_file, tier_key), items in wanted.items():
        by_file[rel_file][tier_key] = items

    files_changed = tiers_written = overrides_written = 0
    for rel_file, tiers in sorted(by_file.items()):
        path = TIER_DEF_DIR / rel_file
        if not path.is_file():
            print(f"  [skip] no tier definition: {rel_file}")
            continue
        original = path.read_text(encoding="utf-8")
        doc = json.loads(original)
        category_key = next((k for k in doc if not k.startswith("//")), None)
        if not category_key:
            continue

        for tier_key, items in tiers.items():
            entry = doc[category_key].get(tier_key)
            if not isinstance(entry, dict):
                continue
            existing = entry.get("item_overrides") or {}
            merged = dict(existing)
            for base, pair in sorted(items.items()):
                # Never clobber a hand-authored override — the card is authored
                # data now, and this script must stay re-runnable.
                if base not in merged:
                    merged[base] = {"PlayAlertSound": pair}
                    overrides_written += 1
            if merged != existing:
                entry["item_overrides"] = merged
                tiers_written += 1

        updated = json.dumps(doc, ensure_ascii=False, indent=2) + ("\n" if original.endswith("\n") else "")
        if updated != original:
            files_changed += 1
            if not check_only:
                path.write_text(updated, encoding="utf-8")

    verb = "would write" if check_only else "wrote"
    print(f"{verb} {overrides_written} card overrides across {tiers_written} tiers "
          f"in {files_changed} files")
    print(f"  from {n_sounds} basetype_sounds entries; "
          f"{n_suppressed} files left silent (suppress_basetype_sounds)")


if __name__ == "__main__":
    migrate("--check" in sys.argv)
