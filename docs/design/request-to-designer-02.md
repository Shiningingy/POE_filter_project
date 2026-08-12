# Request 02 — two new slots, one carried-over question

Carries the one open item from request 01, which was drafted and never sent. Everything
else in 01 was acknowledgement; it is folded in below so this is the only letter you need.

---

## First: your kit checked out, and two pieces of it are our fault, not yours

We re-derived every number in `theme_patch_3.29.json` and `theme_rungs_3.29.json` with
`parsing_tool/theme/check_designer_kit.py` (in the repo — run it yourself before the next
drop):

| | |
|---|---|
| numbered contrast claims | **46 of 47 verify exactly** (tolerance 0.05) |
| rungs-doc vs patch agreement | **13 of 13 identical** |
| pairings under 3.0:1 | **0 of 106** |
| colours that fail to parse | 0 |

One stale number: `visibility_pass.Maps 地图.T0 特殊地图` claims **10.11**; `29 64 124` on
`248 248 242` measures **9.49**. The patch value is right — the rungs doc drifted.

**Two things you specified correctly and we simply never applied.** Flagging them so you
know the gap was ours:

- **The `recipes` accent.** You split `vendor` in two and gave recipes `220 238 242` /
  `26 38 42`, Moon, White beam, `icon_floor: T2`. The Moon and the beam landed; the plate
  never did, so 6-Link / 6-Socket / RGB have been wearing generic ladder colours in game.
  We are applying it now.
- **The redundant `linked` border.** Your note: *"The 6-Link block matches
  `LinkedSockets >= 6`, which is exactly what the `linked` state asserts — suppress it and
  the border stays free for `corrupted`."* We emit it anyway, so today a corrupted 6-link
  cannot say it is corrupted. Also being fixed.

Both were called correctly in your delivery. No action wanted.

---

## ★ Ask 1 — the `equipment` accent is doing too much work

`accent_by_category` maps **13 categories onto the single `equipment` accent**:

```
Campaign · Crafting Bases · Heist Equipment · Heist Experimented · Influenced ·
Magic Net · Mirror of Kalandra Ring Bases · Rare Equipment · and 5 more
```

So a two-handed axe, a body armour and an amulet are the same hue at the same rung. The
author wants to separate them — roughly **weapons / body armour & armour pieces /
jewellery**.

**We are asking rather than specifying, because this is an axis change and it is your
model to reconcile.** Everywhere else in the kit, *accent means family and rung means
value*. Splitting equipment by slot makes the accent encode **where an item equips**, which
is a different question from what family it belongs to. That may be right — slot is what a
player actually scans gear for — but it makes `equipment` the one accent whose meaning
differs from all 23 others, and we would rather you resolve that than have us fake it.

If you take it, the constraint we can state: all three must remain distinguishable from
each other **at the same rung**, since a weapon and a helmet routinely drop together.

---

## ★ Ask 2 — a `net` accent: the "we forgot this" slot

New structural piece, and it needs exactly one look.

**The problem.** Our filter cherry-picks bases by name. Anything uncurated falls to a
magenta catch-all that means *"this filter does not know what this is"*. That is the right
signal for a genuinely unknown class — but it is currently also catching **~610 bases whose
class we know perfectly well** and simply have not curated: 226 stackable currencies, 246
maps, 94 map fragments, 24 breachstones, and so on. Every new league adds more.

**The fix.** One net per item class, all emitted last, ahead of the magenta. They give us a
two-level unknown:

```
net      we know the class, we have not curated the item     <- needs a colour
magenta  we do not even know the class                        <- already exists, stays
```

**What we need from you: one fixed look.** Not a ladder — a net has no rung, because "we
forgot this" has no value ranking. The brief:

- **Legible, and obviously not content.** A player must read it as *the filter is
  incomplete here*, not as a tier.
- **One rung of alarm below the magenta**, not equal to it. Magenta is the emergency.
- **Distinct from all 23 accents at a glance**, since a net sits directly beside real
  content in the same drop.
- **Not grey.** `vendor` grey already means bulk-and-ignorable, and a forgotten item might
  be a Mirror. This slot means *unknown value*, which is the opposite of ignorable.
- Readable at **FS 40** on the author's size ladder.

---

## Carried over from request 01 — one clearance still fails your own test

Your ceiling test: *">= 10° from band neighbours OR >= 30 saturation points."*

| pair | measured | your note | verdict |
|---|---|---|---|
| **corpses rose `232 92 104` vs vaal-red `245 85 75`** | **8.7°, 9 sat pts** | "the tightest", eyeballs pending | **fails both halves** |
| scarab lime vs quest green | 33.2°, 1 sat pt | "~111°, Δ25" | passes — it is 81° vs 114° |
| allflame vs harvest | 16.6°, 23 sat pts | "Δ17" | passes |
| allflame vs gems | 14.9°, 17 sat pts | "Δ15" | passes |
| scarab vs oils | 29.7°, 5 sat pts | "Δ35" | passes |

**Scarab-vs-quest needs no eyeballing** — settled by measurement, drop it from your pending
list. Corpses-vs-vaal-red is the real one, and we would rather move a hue than ship it and
squint. Your own notes suggest the mitigation — the plates are far apart (`214 76 90` at 91%
value vs blood `150 20 40` at 59%). **Your call:** is the plate separation the intended
distinguisher, or does one hue move?

---

## Still not needed: the prose twin

Both files reference `Theme Proposal 3.29.dc.html` and it was not in the zip. **Please don't
produce it.** Handbook §7's "prose beside the values" rule existed to fix the previous
thread's failure mode, where prose and arrays disagreed four separate times. You solved that
better by putting `principle`, `rationale`, `clearance`, `risk` and `note` **inside** the
JSON — one source, so drift is structurally impossible. A second document would reintroduce
the exact risk the rule was written to prevent.

---

## What is happening on our side meanwhile

The nets are being built now with a **placeholder** look, so those ~610 bases stop reading
as emergencies while we wait. Dropping your accent in is a one-line change when it lands —
nothing here blocks on you.
