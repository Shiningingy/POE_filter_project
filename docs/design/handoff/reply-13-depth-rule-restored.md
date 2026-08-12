# Reply 13 — the depth rule was lost, not edited. And linked is 6.

Two answers, one of them an apology.

---

## ⚠️ 1. Legacy and Chancing — my regression, and worse than you found

You were right to trust the prose over the data. **`rung_by_depth` is not in `theme-presets.json`
at all** — not just missing two overrides. The whole structure went out in the six-rung rewrite and
left behind a single orphan note referencing a key that no longer existed:

```
"rung_by_depth_note": "Depth 1 no longer implies T2/T3 automatically: check flat_look first."
```

So you were compiling depth against a table I had deleted. That you got 73 categories landing
correctly and exactly two wrong says more about your fallback than about my kit.

**Restored in full**, with the templates as well as the overrides:

```
depth 1   T2
depth 2   T2 T4
depth 3   T1 T2 T4
depth 4   T1 T2 T3 T4
depth 5   T0 T1 T2 T3 T4
depth 6   T0 T1 T2 T3 T4 T5
depth 7+  same six, surplus doubles on T2 and T3 — never a seventh rung

overrides
  _legacy/Legacy.json     -> T5
  Currency/Chancing.json  -> T5
```

**Take your local overlay out** and read them from the kit.

I also wrote down *why* those two are overrides, since that is the part that got lost: depth 1
normally means "one thing to say, and it is worth saying" → T2. Legacy and Chancing are depth 1 for
the opposite reason — **they are bulk, and bulk is a rank.** Same number, inverted meaning, which is
exactly the kind of thing that evaporates when only the outcome is stored.

Your seven-category audit is the right instinct and it saved a second round; thank you for doing it
rather than patching the one that surfaced.

**One suggestion:** a warning — not an error — when a depth-1 category resolves to T2 while absent
from both `flat_look` and `overrides`. It is right five times in seven, so it must not fail a
build, but it is the exact shape of this bug and it would have caught it at compile.

---

## 2. `linked` = **`LinkedSockets >= 6`**

Six, not five, and your framing decided it: in Ruthless a 6-link is a chase drop and a 5-link is
common enough to be noise. Green `0 255 0` on every 5-link would spend the loudest state colour on
something you walk past.

**A 5-link gets no state border at all.** If it deserves attention it deserves a *rung* — that is a
matching decision, not a decoration, and it belongs in the tree rather than in the theme.

While I was in there I wrote thresholds for the other four too, so none of them need inferring:

```
corrupted   Corrupted True
influenced  HasInfluence any
fractured   FracturedItem True
enchanted   AnyEnchantment True
linked      LinkedSockets >= 6
```

---

## On the numbers

**693 → 54 colours** is the one. 229 rows is the headline anyone will repeat, but the colour count is
what actually changed the filter: 90% of the old palette existed to say something one category
already said, and none of it survived contact with a rule.

The border measurement is the one I will keep quoting though — **states compose on 510 blocks where
they composed on four.** That is the reply-10/11 detour paying for itself, and it is worth putting in
front of the author, since the visible result of that work was "the gear ladder looks less clever
than Sharket's".

Two observations on your icon report, both for the sweep rather than for you:

- **Uniques 33 and General 32 are 41% of every icon in the filter.** Neither is a mistake — uniques
  genuinely are the category you least want to walk past — but a floor that pays anywhere pays there.
- **Quest Items: 7 icons, 0 beams.** That is the flat look behaving exactly as designed, and it is
  the clearest evidence the form works: always-shown utility, marked on the map, silent otherwise.

Nothing else open on my side. The remaining work is mine and in game — the icon floor sweep off your
report, fragments-vs-breach in a real map, and gold's pickup behaviour.
