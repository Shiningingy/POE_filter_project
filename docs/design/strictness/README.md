# Strictness research — 3.29

Banked from workflow `wf_b2952eaa-693`, which was **stopped before its adversarial-review
phase finished**, so the proposals here are UNVERIFIED unless a commit says otherwise.
Committed out of the scratchpad because scratchpads get swept — this one already was.

| file | what it holds |
|---|---|
| `filterblade-rare-ladder-decoded.md` | ★ The upstream ladder, measured from all 7 of their 3.29 files. Their armour ladder is a **DropLevel ladder wearing a base-name coat** (t1 median 84, t2 69, t3 61, t4 53). Strictness never changes a condition — it comments blocks out; `%Dn` = last level a block is active. |
| `our-rare-measurement.md` | What our filter did with rares at each level, before any change |
| `rare-curve-proposal.md` | The proposal. ⚠️ Its "gate the league leaks" recommendation was **rejected by the author** — league bases are meant to be loud at every level. Read the ACTED-ON decisions in git log instead. |
| `filterblade-low-value-currency.md` | Their low-value currency thinning, per base. **Not yet acted on.** |
| `currency-measurement.md` | Our currency measurement |
| `minimal-fontsize-investigation.md` | The `SetFontSize 1` question, and the test filter design |
| `adversarial-review.md` | The one refute pass that completed before the stop |

## What was actually DECIDED (see git log for the commits)

- Rare equipment: `Tier 1` gate REMOVED — the 33 top DropLevel-84 bases show at every level.
  The author's test: a rare **Vaal Regalia** (DropLevel 68, T3) goes Minimal at uber; a
  **Twilight Regalia** (DropLevel 84, T1) still shows.
- League base categories are **deliberately ungated** — "league specific bases should be
  shown at any strictness". An earlier commit gated four of them; that was reverted.
- Curve at AreaLevel 75, rare equipment bases shown:
  `soft 946 · regular 398 · semistrict 293 · strict 173 · verystrict 173 · uber 173 · uberplus 173`
- ★ **Every build shipped before V7.0 was `soft`, where NO gate fires at all.** Moving the
  shipped level to `regular` is a 58% cut with zero data edits — still the biggest unpulled
  lever.
- Crafting bases and tier structure: **not touched**, by the author's instruction.
