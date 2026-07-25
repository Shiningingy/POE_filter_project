# ADR-0005: Ruthless and Standard are separate content trees; player/contributor work arrives as modules applied through a reviewed diff

## Status
Accepted (decided 2026-07-25). Supersedes the overlay mechanism sketched in
ADR-less notes and never built. **Not yet implemented** — the fork happens after
Ruthless tuning is finished; see *Sequencing*.

## Context

Two questions had to be settled together, because the answer to one constrains
the other:

1. How do the Ruthless and Standard (softcore) filters relate — one tree with a
   diff mechanism, or two trees?
2. How does anyone other than the maintainer contribute?

The earlier position was **shared data + an overlay tree**: one base tree, with
`variants/<mode>/` holding only the files that differ, resolved per path. That
was never built, and re-examining it produced the opposite conclusion.

### The two filters are not the same filter with different numbers

Measured, FilterBlade's Standard filter (3.28) against our generated Ruthless
filter:

| | Standard | Ruthless |
|---|---|---|
| blocks | 749 | 413 |
| distinct condition keywords | 33 | 19 |
| `Class` conditions | **551** | **18** |
| `BaseType` conditions | 410 | 382 |
| `Rarity` conditions | 428 | 118 |

Standard uses 15 condition keywords Ruthless never touches — `Mirrored` (88),
`DropLevel` (44), `GemLevel`, `AnyEnchantment`, `FracturedItem`, `BlightedMap`,
the Eater/Exarch implicits. Ruthless uses exactly one Standard does not
(`Vestigial`, and only because ours is 3.29 and the comparison filter is 3.28).

The decisive number is the **axis inversion**: Standard is class-driven with
conditions layered on top; Ruthless enumerates base types. Expressing one as a
per-value diff of the other therefore means diffing nearly every line — an
overlay or an inline mode-map would be *more* machinery describing *more*
difference, not less.

### The two trees have different maintainers

The Ruthless tree is maintained by one person, and Ruthless contributors are
hard to find. Standard work is expected to come from volunteers. Any mechanism
that keeps both filters in the same files puts a solo maintainer and outside
contributors on the same lines — the worst available arrangement.

### The recurring cost is small

`parsing_tool/ggpk/reconcile.py` against 3.29: **109 base types added, 0
removed**, of which 81 were already mapped or class-covered. A league's delta is
~100 items. The expensive part of two trees is the initial authoring, which is
one-time; steady-state maintenance is small and, crucially, *different work* for
each tree anyway.

### Contributors suggest; the maintainer owns

Volunteer input is feedback, not a write. And player needs are not a single
alternative filter — every player has a different bias, and the *same* player
wants different things per build. That is a per-player, composable axis, not a
third tree.

## Decision

### 1. Modes are separate content trees over a shared foundation

```
filter_generation/data/
  catalog/          <- GGPK pipeline output, never hand-edited     SHARED
  theme/  sounds/                                                  SHARED
  filters/
    ruthless/   tier_definition/ base_mapping/ category_structure.json
    standard/   tier_definition/ base_mapping/ category_structure.json
```

Generator code stays **identical** across modes (ADR-0001's parity invariant is
untouched): it takes a tree path instead of consulting `MODE` for content.
`HIDE_CMD` (`Minimal` under Ruthless vs `Hide`) stays — that is a genuine
code-level difference the game imposes.

`_meta.excluded_modes` largely **retires**. Today's 11 `["ruthless"]` exclusions
become "files the Standard tree has and the Ruthless tree does not" — one fewer
concept than now, not one more.

Game version (PoE1/PoE2) remains separate top-level trees for the same reason,
only more so: the item data itself differs.

### 2. Contributor and player work arrives as *modules*

A module is an opt-in, composable set of proposed changes, tagged onto tiers and
gated by a selection — generalising the campaign picker's existing gate:

```python
# today, campaign-specific (generate.py)
lv = tier_entry.get("lv_group") or {}
if lv.get("axis") == "weapon":  return lv["key"] in SELECTION.get("weapons", [])
if lv.get("axis") == "armour":  return lv["key"] in SELECTION.get("armour_defense", [])

# generalised
m = tier_entry.get("module") or {}
return m.get("key") in SELECTION.get(m.get("group"), [])
```

The generalisation makes the code *smaller* and reuses machinery already
shipping and already parity-guarded in both generators.

Modules live in their own files and are off by default, so a contributor's
module cannot affect the maintainer's filter — the contribution surface and the
owned surface never overlap. Modules are orthogonal to mode and can serve either
tree.

### 3. A module is applied through a reviewed diff, never silently

Enabling a module changes what the tree produces, so it is presented as a
**diff against the current tree, with per-change selection** — the GitHub
model. This holds even for a single enabled module. Nothing is applied that was
not seen.

One surface serves three cases that until now were separate features:

| case | proposal format |
|---|---|
| volunteer suggestion | triage console export JSON (`parsing_tool/ggpk/render_console.py`) |
| importing another filter | selective import (already shipped) |
| player module | module resolution |

`parsing_tool/ggpk/apply_decisions.py` already implements the non-UI half: it
refuses a tier outside the target's `tier_order`, refuses to re-home a name
mapped in another file, and *reports* conflicts rather than resolving them.

**Conflicts between modules are surfaced, not auto-resolved.** With
player-authored modules the collision rate rises, so first-match-wins emission
order stays the tiebreak for generation, but the UI shows the competing claims
and lets the user choose.

**A query-defined module's diff is computed, not stored.** "Boots with movement
speed" resolves against the catalog, so it resolves to a different set next
league. The diff view must therefore show the **resolved item list**, not just
the query — otherwise you would be approving something you cannot see. This is
the intended behaviour: module upkeep collapses into the same per-league review
loop as everything else.

### 4. Store the module stack, not the mutated tree

Applying a module does **not** permanently rewrite the tree cached in the
browser. What is persisted is the ordered stack of enabled modules plus the
per-change accept/reject decisions; the working tree is *derived* by replaying
that stack over the base.

The obvious benefit is that revert and reorder are free — drop or move an entry
and replay. The load-bearing one is different:

> **A stored stack survives a base update; a mutated snapshot does not.**

When a new league's base tree ships, a browser holding a mutated copy is
stranded — the user's customisations are either clobbered or need a merge. With
a stack, the modules replay over the *new* base, and anything that no longer
fits surfaces as the same diff review. League updates and module upkeep become
one operation instead of two.

Order is part of the stored state because order decides first-match-wins, so
reordering is a real, reviewable action.

Two requirements follow, both from failures this project has already had:

- **Rejections are recorded, not just acceptances** — as "rejected against
  version V". Otherwise a module re-proposes a rejected change every league. It
  should stay quiet while the proposal is unchanged and re-surface when it is
  not.
- **Orphans surface as conflicts, never as silent skips.** An entry addressing a
  file, tier, or item the new base renamed or retired goes to review. Resolving
  it quietly is exactly how 525 curated entries went missing from the generated
  filter (see `CONTEXT.md`, coverage model).

Performance: replay **once** into a memoized resolved tree, invalidated when the
stack changes. Replaying per render is the version of this that feels slow.

## Consequences

- The initial Standard tree is real authoring work. Open at decision time:
  start it as a copy of Ruthless and diverge, or from scratch on a class-driven
  skeleton. The axis inversion argues for from-scratch.
- A genuinely shared structural improvement must be made in both trees. Accepted
  — the shared surface is item data and editor features, not filter structure.
- Automatic validation stops being optional. A contributor can trivially
  reintroduce the "undeclared tier key emits nothing" class of bug (see
  `CONTEXT.md`, coverage model). Rejecting undeclared tier keys, base types
  absent from the catalog, and unparseable JSON becomes the gate that makes
  outside contributions safe to accept.
- Tooling that reduces *solo* effort is worth more than tooling that reduces
  total team effort, because the Ruthless side has a team of one.

## Sequencing

**Do not restructure yet.** Ruthless tuning continues in the current tree; the
current tree *is* the Ruthless tree, so the fork is later a `git mv` plus a copy.
Restructuring mid-tuning risks the tuning and buys nothing.

## Alternatives rejected

- **Overlay tree (`variants/<mode>/`)** — resolution per path, base fallback.
  Rejected: the divergence is structural rather than per-value, so most files
  would be overlaid anyway; it adds a third parallel tree to a repo where the
  existing two-tree pairing has already failed silently and lost a whole
  category; a renamed base file orphans its overlay with no error.
- **Inline mode maps** (`{"ruthless": ..., "standard": ...}` per value) —
  rejected for the same structural reason, plus it puts both maintainers in the
  same lines.
- **A per-mode profile/config** — previously rejected and still rejected: those
  are descriptions of Ruthless, not knobs. Softness lives in tier data.
- **Persisting the module-modified tree in the browser** — rejected. It makes
  revert a bookkeeping problem and strands the user's customisations the moment
  a new base tree ships. Store the stack and derive the tree instead.
