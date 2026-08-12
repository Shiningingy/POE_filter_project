# Reply 07 — heist: copy how FilterBlade tiers it

Author asked whether we should follow FilterBlade on contracts and blueprints. Measured it, and yes
— but the thing worth copying is **structural, not chromatic.**

## What they actually do

```
# !! Waypoint c9.maplike.all : "Maplike - contracts, logbooks, blueprints, memories"
	Class == "Blueprints" "Contracts"

Show  # %H5 $type-?heist-?contract $tier-?handpicked
	Class == "Contracts"
	BaseType == "Contract: Bunker" "Contract: Laboratory" "Contract: Mansion"
	            "Contract: Prohibited Library" "Contract: Records Office" "Contract: Repository"
	            "Contract: Smuggler's Den" "Contract: Tunnels" "Contract: Underbelly"

Hide  # $type-?heist-?contract $tier-?exhide
	Class == "Contracts"

Show  # $type-?heist-?blueprint $tier-?handpicked
	... the same nine areas, as Blueprint: X
```

Three things in there:

1. **Contracts and blueprints are matched together** — `Class == "Blueprints" "Contracts"`.
2. **Heist is "maplike"**, grouped with logbooks and memories rather than treated as its own loot
   family. That is a category-tree observation, not a palette one.
3. **The rung is the AREA, not the item.** The tier split is a handpicked list of nine areas —
   Bunker, Laboratory, Mansion, Prohibited Library, Records Office, Repository, Smuggler's Den,
   Tunnels, Underbelly — with everything else a rung lower and the worst explicitly hidden.

## What to adopt

```
handpicked area  -> T2   (icon + Temp beam)
any other area   -> T4
excluded area    -> hidden — emit no style lines at all
```

One list drives both ladders, since it applies identically to `Contract: X` and `Blueprint: X`.

**Why this is worth doing:** our heist ladder is two rungs deep and has no notion of which area is
worth running. A `Contract: Tunnels` and a `Contract: Cargo Hold` look identical today. That is the
biggest legibility win available in the category and it costs one BaseType list.

## ⚠️ This is a matching change, not a theme change

Per `theme-pipeline-rewrite.md` this belongs on the **rules axis** — the handpicked list is a rule's
`targets`. The theme side needs nothing new: it is the T2 and T4 presets we already have. Flagging
it because a "designer asked for heist tiers" ticket could easily land in the wrong workstream.

Also relevant to your §3 note last round: this is exactly the case where **a tier split does not
imply a different look**. Handpicked and any-area are different rungs because strictness should be
able to drop one, and they happen to differ in look as well — but the mechanism is the rule.

## One open question

**Should blueprints sit a rung above contracts at the same area quality?** A blueprint is the bigger
commitment, so there is an argument for it. NeverSink treats them alike. My instinct is to follow
them and keep one list — but it is a play-feel call, not a design one.

## Unchanged

Heist keeps its red accent and Cross shape, and stays capped below the white plate so it can never
read as mirror-class. Heist Equipment and Heist Experimented remain on the `equipment` accent.
