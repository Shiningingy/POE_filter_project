"""Generate the state-border decorators from the designer's `state_borders`.

    python parsing_tool/theme/build_decorators.py --apply

★ EMISSION ORDER IS THE REVERSE OF `rank`. `rank` is PRIORITY — 1 is highest — but a decorator
composes with `Continue`, and under `Continue` the LAST matching block wins the channel. So the
highest-priority state has to be emitted LAST:

    corrupted(5) -> linked(4) -> influenced(3) -> fractured(2) -> enchanted(1)

Enchanted beats corrupted. This only shows up on a double-state item, so it would ship wrong
silently — hence the comment here and the ordering test.

⚠️ A decorator paints ONLY channels the content block leaves unset (a block without `Continue`
terminates matching, so decorators must be emitted before the content and the content wins any
channel it sets). That is why no rung sets a border: 225 of the 229 compiled theme rows leave
it free, and the four that do not are the deliberate exceptions — gold and the T5/flat forms on
classes that hold no states.
"""
import json, io, os, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from expand_goldens import P                                        # noqa: E402

DEST = os.path.join(ROOT, "filter_generation", "data", "tier_definition",
                    "_decorators", "States.json")

# How each state is MATCHED. Taken from the conditions the tree already uses, so a decorator
# fires on exactly the items the ladders already recognise as being in that state.
CONDITIONS = {
    "corrupted":  {"Corrupted": "True"},
    "fractured":  {"FracturedItem": "True"},
    "influenced": {"HasInfluence": "Shaper Elder Crusader Hunter Redeemer Warlord"},
    "enchanted":  {"AnyEnchantment": "True"},
    # SIX, not five (reply 13): in Ruthless a 6-link is a chase drop and a 5-link is common
    # enough to be noise, so green on every 5-link would spend the loudest state colour on
    # something you walk past. A 5-link gets no state border at all — if it deserves attention
    # it deserves a RUNG, which is a matching decision and belongs in the tree.
    "linked":     {"LinkedSockets": ">= 6"},
}

LABELS = {
    "corrupted":  {"en": "Corrupted", "ch": "腐化"},
    "fractured":  {"en": "Fractured", "ch": "破碎"},
    "influenced": {"en": "Influenced", "ch": "势力"},
    "enchanted":  {"en": "Enchanted", "ch": "附魔"},
    "linked":     {"en": "Linked", "ch": "连接"},
}


def hexify(v):
    p = [int(x) for x in str(v).split()]
    if len(p) == 3:
        p.append(255)
    return "#" + "".join("%02x" % x for x in p)


def build():
    states = {k: v for k, v in P["state_borders"].items() if not k.startswith("_")}
    # emit lowest priority first so the highest-priority state lands LAST and wins
    order = sorted(states, key=lambda k: -states[k]["rank"])
    order = [s for s in order if s in CONDITIONS]

    tiers = collections.OrderedDict()
    for s in order:
        tiers[LABELS[s]["en"]] = collections.OrderedDict([
            ("decorator", True),
            ("conditions", CONDITIONS[s]),
            ("theme", {"BorderColor": hexify(states[s]["border"])}),
            ("localization", LABELS[s]),
        ])

    doc = collections.OrderedDict()
    doc["States"] = collections.OrderedDict([
        ("_meta", collections.OrderedDict([
            ("theme_category", "States"),
            ("localization", {"en": "State Decorators", "ch": "状态叠加"}),
            ("tier_order", [LABELS[s]["en"] for s in order]),
            ("_emission_note",
             "Order is the REVERSE of state_borders.rank: rank 1 is highest priority, and "
             "`Continue` means the LAST matching block wins the channel, so the highest "
             "priority must be emitted last. Enchanted beats corrupted."),
        ])),
    ])
    for k, v in tiers.items():
        doc["States"][k] = v
    return doc, order, states


if __name__ == "__main__":
    doc, order, states = build()
    print("emission order (lowest priority first, so the highest wins under Continue):")
    for s in order:
        print("   %-11s rank %d  border %-12s -> %s"
              % (s, states[s]["rank"], states[s]["border"], list(CONDITIONS[s].items())[0]))
    missing = [s for s in states if s not in CONDITIONS]
    if missing:
        print("   NOT generated (no condition specified): %s" % ", ".join(missing))
    if "--apply" in sys.argv:
        io.open(DEST, "w", encoding="utf-8").write(
            json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
        print("wrote %s" % os.path.relpath(DEST, ROOT))
    else:
        print("(dry run — pass --apply)")
