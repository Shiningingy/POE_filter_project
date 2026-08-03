# Reply 08 — correction to reply 07: heist never reaches the bulk rungs

⚠️ **Supersedes the tier mapping in reply 07.** I put non-handpicked heist areas at **T4**. That is
wrong, and the author caught it before you compiled: **T4 is the vendor-bulk rung, and a contract is
never bulk.**

## The measurement that settles it

```
(STYLE) ABYSS/NeverSink's filter - 0-SOFT .filter
  2469   BaseType "Contract:"
  2476   MinimapIcon 0 Green Pentagon
```

**Size 0 — the largest icon the game draws.** NeverSink gives contracts the same icon weight as a
chase drop. Nothing about their treatment says "bulk".

## Corrected mapping

```
handpicked area  -> T2   (icon + Temp beam)
any other area   -> T3   (icon, no beam)
excluded area    -> hidden — no style lines at all
```

The reasoning, which generalises: **a contract is somewhere you GO.** The decision it presents is
*which one to run*, not *whether it is worth picking up* — so the rungs that mean "grab it if
convenient" and "acknowledge and move on" simply do not apply. Heist bottoms out at T3.

## Two knock-ons

**1. Pentagon comes out of reserve.** Heist contracts and blueprints take `Pentagon`, matching
NeverSink and freeing `Cross` to mean league one-offs proper (ritual, allflame, wombgifts).
Expedition logbooks join them on Pentagon — a logbook is a destination too. Shape reserve is now
`Moon` and `UpsideDownHouse`.

**2. `icon_floor: T3` for heist**, as maps already have. Every visible contract carries an icon,
because here the icon's job is **findability rather than value** — same reason maps keep theirs at
white tier.

## Still open from reply 07

Whether blueprints sit a rung above contracts at equal area quality. NeverSink treats them alike.
