# Reply to ask-05 — derive from bases, not labels; and the icon floor gains one rule it was missing

rev 31. Your correction is accepted and it makes the rule better than mine was.

---

## 1 · Derive from BASES. `item_class` is retired as an input

No apology needed for the first-file-wins bug — you found it, and the recount changed the
answer, which is the whole point of asking. What matters more is the second finding, which
neither of us had:

> **`Influenced` declares `Body Armours` and its bases are 10% body armour.**

That kills `item_class` as an input entirely, and not because it drifts — because it was
never a description. A typed label cannot be trusted to describe contents even when it is
single-valued and *looks* right. Deriving from the classes of the actual bases needs no
metadata, cannot drift, and rescues the cases where the label is not even a GGPK class
(`Magic Net` 100% jewellery, `Ritual BaseTypes` 100% armour).

So, rev 31:

- **Group = derived from bases, ≥95% purity.** Your 16 group-pure categories take their
  hue automatically.
- **The hand map drops to zero entries** — the three `Jewels/*` files resolve themselves
  (100% jewellery). ask-04's three-entry map is deleted along with ask-04's rule.
- **Flasks is a fifth group** (Life/Mana/Utility/Tinctures), no own hue — consumables fall
  through to `gear_quiet`, same as weapons and armour. Only jewellery gets a plate.
- **The 7 span-group categories take the mixed accent**, `Influenced` and `Heist
  Experimented` included. Both were my guesses and both were wrong the same way — armour by
  assumption, mixed in fact.

`Enshrouded Gear` sitting outside all four groups is the confirmation I wanted: it is a
state look, not a group member.

## 8 · Icon report — thank you for separating (a) and (b), because they exposed a missing rule

Your split does the analytical work: 27 of the 64 are top-tier and single-tier cases, and
you are right that they are the §7 backlog wearing a different hat. But they also reveal a
rule the icon floor never stated, and should have:

> **A category's TOP TIER always carries an icon, wherever it sits on the global scale —
> and the icon rises with the tier when the ladder grows.**

Without that, a flat category's only rung loses its icon purely because the global scale put
it at R3, which is exactly backwards: the top of a category is the one thing in it a player
is definitely walking to. So: **do not strip any of the 27.** They are not defects and they
are not exceptions — they are the rule, now written down.

Of the remaining ~37, most retire. Four relaxations stand **on purpose**, because they are
the precise findability cases the channel exists for:

| category | ruling |
|---|---|
| `Maps/Fragments` | **keep icons through R3**, drop only R4 Tier 4. Fragments are pickup-always in Ruthless; a fragment off-screen is the exact case. |
| `Maps/Scarabs` | keep R3, drop R4. Scarab visibility was an explicit author ask. |
| `Gems/Skill` | keep R3, drop R4 Tier 4 and R5 Tier Net (a net is a safety net, not a pickup). |
| `Currency/Tainted Currency` | keep R3, drop R4. Corrupted currency is worth the walk. |

Cut cleanly: `Currency/General` R3 Tier 5/6 (scroll-and-shapestone bulk — the pickup floor's
whole reason for existing), `Uniques/General` R3 T3 + Other (a bulk unique is a vendor trip,
not a run), `Cluster Jewels` R4/R5 and `Base Jewels` R4 (the rarity plates already carry it;
the safety-net Crosses retire as ruled in ask-02).

`Misc/General` — 14 blocks on one tier at R3 — is **a category with no ladder, not 14
defects.** Give it its icon under the top-tier rule and re-tier it later.

**Target after the cut:** zero R3+ icons except the four relaxations above and every
category's top tier. Please re-run the report then; that number is the one I want to see.

---

Everything in your "absorbed" list is settled as recorded. `state_budget` remains yours.

— design side, rev 31 (accents, rungs, filter-lines stamped)
