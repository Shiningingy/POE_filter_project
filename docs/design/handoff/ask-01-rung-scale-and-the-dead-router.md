# Ask 01 — the rung label is section-local, and the router that would catch it is dead code

**From:** code side · 2026-08-19 · against rev 27.1
**Short version:** a player reported common fossils and resonators reading as a mute tier. We
traced it and **found nothing mis-implemented** — our rows are byte-exact to your
`theme-patch-rev27-1.json → "Fossils & Resonators"`. That is the reason we are writing. The
port is correct and the result is still wrong, which means the error is upstream of the port,
in how a rung is named and in what stopped checking it.

Two mechanism findings and one content question. Nothing here is urgent; all of it is the kind
of thing that gets more expensive per drop.

---

## ★ Finding 1 — `R2` means two different things in one drop

`theme-rungs-rev27-1.json → rungs` defines **one global scale, R0–R5**, and it is explicit that
only the top two are house-pinned:

```
R0  HOUSE, pinned   255 0 0 on 255 255 255, border 255 0 0
R1  HOUSE, pinned   255 255 255 on 210 0 0, border 255 255 255
R2  "Hue families: WHITE text on the FAMILY plate…"   <- family-derived
R3  "…family colour on the family's DARK TINT…"       <- family-derived
R4  "…family colour on PURE BLACK…"                   <- family-derived
R5  game default — emit no style lines
```

The `Fossils & Resonators` section of the patch labels its four rows `R0 premium`, `R1 good`,
`R2 mid`, `R3 common`. But by **value**:

| patch label | value | global rung with that value |
|---|---|---|
| `R0 premium` | `#ff0000` on `#ffffff` | R0 ✅ |
| `R1 good` | `#ffffff` on `#d20000` | R1 ✅ |
| `R2 mid` | `#000000` on `#ffaa00` | **R3** (`currency_ladder.R3`, "alch-level") |
| `R3 common` | `#000000` on `#aa9e82` | **R4** (`currency_ladder.R4`, "Armourer's Scrap level") |

So the token `R2` names the vermilion rung in one file of this drop and the orange rung in
another. A porter reading either file alone is correct and the two ports disagree.

The section's own note is where it shows:

> `"Fossils & Resonators": "R0 premium(12 fossils+prime resonators) · R1 rest-good · R2 mid · R3 common — currency bands verbatim"`

It is **not** the currency bands verbatim. `_tier_map.Currency` lists five plates — R0 white,
R1 house red, **R2 FB vermilion**, R3 orange, R4 tan. Fossils has four and skips the vermilion.
"Verbatim" is doing real damage here, because it is the sentence that tells the porter not to
look.

We do not think this is a value error — a four-rung fossil ladder is a defensible call. It is a
**naming** error, and it is the same shape as `_note_discipline` in `accent-category-map.json`
("a note must not restate a value that lives in an array"): a label that restates a rung is
either quoting the global scale or contradicting it.

**Ask:** can patch sections label rows with the **global** rung id they resolve to, or with a
bare position index (`1st`, `2nd`) that is obviously not an R-number? Either kills the
collision. Reusing `R0..Rn` per section is the one option that cannot be made safe, because it
looks correct in both readings.

---

## ★ Finding 2 — `rung_by_depth` is still declared, still quoted, and no longer runs

`accent-category-map.json` calls itself the *"PRIMARY owner of accent routing AND
rung_by_depth"* and ships four `_invariants` described as *"Four assertions. Each one is a bug
this thread has already shipped once."*

None of the four is checked today, and the table itself is not applied. Measured against our
tree just now:

```
ladders measured                          65
match rung_by_depth                       25   (38%)
drifted                                   40

no_silent_misses  — VIOLATED
    "States"      in accent_by_category, is not a live theme category
    "Class Nets"  is a live theme category, is not in accent_by_category
    (the kit: "a miss on either side is an ERROR, never a fallback")
```

The mechanical cause is traceable to one commit. At rev 23 you instructed
*"if a value appears anywhere else, it is stale by definition"* and `theme-presets.json` was
deleted. That was right about the **stale values** — its scarab jade was three revisions dead
and it had already caused two reverted passes. But it was also the only machine-readable copy
of the **24 accents**, and it is what `compile_theme.py` and `expand_goldens.py` import:

```
python parsing_tool/theme/compile_theme.py
  FileNotFoundError: docs/design/handoff/theme-presets.json
```

So the recipe pipeline — the thing that expanded both goldens byte-exact after reply 12 — has
not run since rev 23. What replaced it is a **porter that writes painted rows**. That works,
and it is why rev 25/27/27.1 landed cleanly. What it cannot do is notice drift, because with
painted rows there is no derivation left to disagree with.

The rot is measurable:

```
theme rows                                181
  rows no live tier reads                  42   (23%)
tiers                                     315
  tiers with inline style beating the row  98   (31%)
```

Fossils is a clean example of the whole problem: its rung **digits** (1,2,3,4) are exactly what
`rung_by_depth.value["4"]` prescribes, so the routing was right — and the **recipe** painted
into those digits came from the currency ladder rather than the `fossils` accent that
`accent_by_category` assigns it. Routing correct, look unrouted, nothing able to tell.

**Ask, and this is the one that matters:** is `rung_by_depth` binding at rev 27.1?

- **If yes** — we need the 24 accents back in a machine-readable file so the compiler can run
  and the four invariants can be enforced in CI. It does not need to be `theme-presets.json`
  and it does not need to carry looks you have since revised; it needs to be the *one* place an
  accent RGB lives, stamped with a rev like the other three files.
- **If no** — please delete `rung_by_depth` and `_invariants` from `accent-category-map.json`.
  Right now they read as authoritative, they are quoted in our commit messages, and they are
  the reason we spent this session's first hour reconstructing a model that is not in force.

We would rather have a small stamped file than a large accurate one.

---

## The proposal, since you asked for one

**Let a tier declare a rung and nothing else; derive every colour.**

```
tier_definition:   { "rung": "T3" }          <- the only theme key a tier may carry
theme-presets:     24 accents × 6 rung recipes + house pins + flat-look exceptions
accent-map:        category -> accent, ladder-depth -> rungs, explicit overrides
sharket_theme.json BUILD ARTIFACT — compiled, never hand-edited, never committed by hand
```

A drop then changes an **accent**, a **rung recipe**, or a **routing entry**. It never restates
a painted row, so the class of error in Finding 1 cannot be expressed and the drift in Finding 2
cannot accumulate silently. The compiler asserts the four invariants and fails the build.

We are not proposing this as a fait accompli — it is roughly the shape the kit already
describes, and the honest summary is that we stopped implementing it at rev 23 for a good
local reason and never said so. The two costs we can see:

- **You lose per-row hand-tuning.** Today you can pin one category's plate without touching an
  accent. Under this, that becomes an explicit `overrides` entry — more ceremony, and visible.
- **The first compile changes many colours at once.** 31% of our tiers currently carry inline
  style that overrides the row; those have to be reconciled before a compile is trustworthy.
  That is our work, not yours, but it is why we have not simply done it.

If per-row tuning is something you want to keep, the cheaper half is still worth having on its
own: **keep painting rows, but stamp each row with the global rung it means**, and let us
assert routing + invariants against that. That fixes Finding 1 outright and turns Finding 2
from silent into loud, without changing how you author.

---

## The content question, which is separate from all of the above

The player's actual complaint stands regardless of mechanism: they think common fossils and
Chaotic Resonators do not deserve the Armourer's-Scrap plate in Ruthless. Their words —
*"should be at least alch level"*.

We checked FilterBlade's Ruthless filter before forming a view, per our own rule that when
FilterBlade does something there is usually a reason:

```
t1  Faceted, Fractured, Glyphic, Hollow, Prime Chaotic Resonator     red on white
t2  Gilded, Opulent, Sanctified                                      white on 240 90 35
t3  Aberrant, Aetheric, Bloodstained, Bound, Corroded, Dense,        BLACK on 240 90 35
    Jagged, Lucent, Metallic, Prismatic, Pristine, Serrated,
    Shuddering, Tangled                            (14 bases)
t4  Deft, Frigid, Fundamental, Scorched, + Potent/Powerful/          black on 249 150 25
    Primitive Chaotic Resonator                                      
t5  (COMMENTED OUT)                                                  black on 210 178 135
```

Their lowest **live** fossil rung is a bright amber, and their tan rung is disabled — nothing
lives on tan. Ours puts ten bases there. Ruthless fossil scarcity is the player's argument and
we think it is a fair one.

**Ask:** should `Fossils & Resonators` take the full five-step currency band — adding the
vermilion the note already claims it uses — so the floor lands on the orange rather than the
tan?

```
current (4 rungs)              proposed (5 rungs)
  R0  red on white               R0  red on white          Faceted, Fractured, Prime Res.
  R1  white on #d20000           R1  white on #d20000      Bloodstained, Glyphic, Hollow,
                                                           Sanctified, Tangled, Powerful Res.
  R3  black on #ffaa00           R2  white on #f05a23      Aetheric, Bound, Corroded, Deft,
                                                           Fundamental, Gilded, Opulent,
                                                           Serrated, Shuddering, Potent Res.
  R4  black on #aa9e82           R3  black on #ffaa00      Aberrant, Dense, Frigid, Jagged,
      ^ 10 bases here                ^ the player's ask     Lucent, Metallic, Prismatic,
                                                           Pristine, Scorched, Primitive Res.
```

We have **not** made this change — it is yours, and we would rather ask than port a guess.

---

## Three more instances of Finding 1, since they show the two ways it lands

We scanned every theme row for "carries a recipe that belongs to a different global rung" and
got five hits — two in Fossils (above) and these three. All three rows are **live**, and they
fail in two distinct ways that are worth telling apart:

- **`Wombgifts` rung 3** — the row holds R0's red-on-white. The tier pointing at it carries an
  inline `#ffffff` on `#d20000` that wins, so the emitted block is R1 and the row's value is
  read and discarded. The ladder looks right in game and the theme file is wrong about it.
  This is the 31%-inline number made concrete: **the row is not the answer, so an audit of rows
  cannot tell you what ships.**
- **`Runegrafts` rung 3** — the row holds R1's white-on-`#d20000` and there is no inline, so its
  **top** tier genuinely renders as R1 while sitting three rungs down. Worse, its other two
  tiers take rungs 4 and 5, and in this category those two rows are **byte-identical**
  (`#aa9e82` on `#000000f0`) — a three-tier ladder with two visible steps. This one is a real
  defect and we will fix it once we know which scale to fix it against.
- **`Tainted Currency` rung 1** — the row holds R0's red-on-white. Its ladder reads correctly
  in game (red-on-white → crimson → tint → black) because it is internally consistent; it is
  only wrong relative to the global scale. Harmless today, and exactly the kind of harmless
  that stops being harmless when someone writes a rung-keyed change.

The first and third need no action if the answer to Finding 2 is "the table is not binding".
The Runegrafts one needs action either way.

---

## Not defects, recorded so they are not re-reported

- **Alchemical Resonators reading grey-on-dark is correct.** All four are in `_legacy` and wear
  the legacy look. FilterBlade's Ruthless filter does not name them once, which corroborates
  the placement. The player saw these alongside the Chaotic ones and reasonably lumped them
  together.
- **The green border on fossil `R1 good` is yours**, authored in the patch. We flagged it
  internally as a deviation from the house R1 white border before finding it in your file.
  Left exactly as authored.
- **The fossil rung *digits* are right.** `rung_by_depth.value["4"]` prescribes T1 T2 T3 T4 and
  that is what our four fossil tiers declare. If the table is binding, Fossils is one of the 25
  ladders that already conforms — only its painted recipes are off-family.

---

**We changed no theme values while investigating this.** The fossil re-rung and the Runegrafts
repair are both waiting on your answer rather than being ported on a guess.
