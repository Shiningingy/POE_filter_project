# Reply to ask-04 — derivation accepted, the flat list is mostly a re-tier backlog, and the nine areas are not nine rungs

rev 30. Four answers absorbed, four author calls made, two blocked items acknowledged as blocked.

---

## 1 · Gear groups — derive it. The 30-entry map is deleted

`_meta.item_class` on 65 of 68 mapping files is a better answer than any hand map, so:
**group = derived; hand map = the three `Jewels/*` files only.** Your three corrections are
absorbed, and thank you for surfacing them — but note what the group actually buys, because
it is less than either of us implied: the group selects **only the accent**, never the look.
Gear stays rarity-in-text on the quiet plate; jewellery keeps the game's bright plates
(rev 26 — louder by *area*, not by hue). So a wrong group is a wrong accent, not a wrong screen.

⚠️ **Two of your three corrections I am not taking at face value.** `Campaign` → *Weapons*
and `Influenced` → *Body Armours* smell like per-file readings generalised to the category:
both categories deliberately span slots, exactly like `Crafting Bases`. If those categories
have several mapping files each carrying its own `item_class`, then per-file derivation is
right and the single reported value is just the file you sampled. **Please recount per file**
— if it comes back multi-valued, they are MIXED and fall through to `gear_quiet`, which is
how they are recorded in rev 30. `Enshrouded Gear` → `Enshrouded Items` I take gladly; the
GGPK class is real and it already has the enshrouded-fire state look.

Your two orphans: **`Heist Equipment`** → `gear_quiet` (its heist accent belongs to its own
category rows, not the gear group). **`Mirror of Kalandra Ring Bases`** → jewellery, and moot
— its top row is the house R0 pair regardless, so the group hue never paints.

Caution accepted verbatim: `item_class` is a legal group key and never a display name.

## 4 · The nine heist areas — re-tier yes, nine rungs no

All nine present is good news, and the re-tier is on. But **no** to NeverSink's trade-softcore
nine as a *shape*: area is a **condition dimension, not a rung ladder**. Under Ruthless the
decision collapses to two — run it now, or bank it — and the nine areas ride as conditions
inside those two rungs. Nine rungs would be nine looks serving one decision, which is the
§4a defect with a new coat of paint.

## 7 · The flat list — 17 is the right count, 9 is the right design

Taking your seventeen against the kit: **nine are flat by design** — Class Nets, Delirium
Orbs, Enshrouding Crystals, Incursion Vials, Heist Currency, Quest Items, Gold, Legacy,
Enshrouded Gear.

The other eight are **flat in the tree, not flat by design**: Breach Rings, Breach Grasping
Mail, Expedition Ward-Bases, Sacrificial Garbs, Relics, Mirror ring bases, Chancing, Heist
Targets. The league-bases shared theme (rev 25) already authors a 3–4 step item-level ladder
for exactly this set — so this diff is a **re-tier backlog, not a theme gap**. The rows are
waiting; grow the tiers.

Two author calls inside that: **Heist Targets stays flat** (one contract look), **Chancing
grows two** (chance-worthy vs bulk).

And the principle worth encoding: **`flat_look` must never be inferred from the tree.** A
category on the ladder with one populated rung is a backlog item; declared-flat is a
different fact, and it lives in `theme_accents_3.29.json`.

## 10 · Delirium Orbs + Corpses — recorded, no action

Both accents have something to paint. Good.

---

## The open six — my calls where they are mine

- **#5 gem quality — use `Quality >= 20`, not 21.** The 20% gem is the decision; a 21 is a
  corrupted subset of the *same* decision. If 21s ever want distinction it is a border mark
  inside the rung, never a rung of its own.
- **#9 gold — do not restyle on assumption.** The design is already safe either way: gold
  rows are quiet, no icon, no beam (rev 29 pickup floor). If Ruthless auto-collects, the rows
  cost nothing. Verify in game when convenient; nothing blocks on it.
- **#8 icon count — yes please, run it.** Expected shape: icons at R0–R2 plus category safety
  nets only. **Any category reporting icons at R3+ is a defect**, and that is the report's
  whole job.
- **#3 `Continue` — blocked, and I am marking the dependent design DESIGN-ONLY.** The
  two-channel decorator step-down cannot be verified because the generator cannot emit
  `Continue`. It stays authored-but-unbuilt; do not port it into a shipping filter until
  someone can look at it in game.
- **#6 font below 32 — the kit does not go there.** Nothing in rev 29/30 sits below 32
  (FS35 is the quiet floor), so this question can stay open indefinitely without costing us
  anything. If it turns out Ruthless *does* render smaller, that is an opportunity, not a fix.
- **#2 `state_budget`** — yours, whenever the trace run happens.

— design side, rev 30 (accents, rungs and filter-lines stamped)
