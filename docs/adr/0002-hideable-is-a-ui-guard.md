# ADR-0002: `hideable` is a UI-authoring protect-guard, not a generator field

## Status
Accepted.

## Context
A reviewer flagged `hideable` as dead ("present in every tier file, read by no generator")
and proposed retiring it. That is a misread of an intentional design.

## Decision
`hideable` is enforced **only in the editor / authoring layer**, by design. The generators
(`generate.py`, `filterGenerator.ts`) intentionally do not read it. `hideable: false` marks
a tier as **protected** — it cannot be gated by strictness or hidden — surfaced as the 🔒
lock toggle. It exists to prevent accidentally hiding a high-value block.

## Consequences
- Do NOT delete `hideable` as unused; it is load-bearing in the UI.
- Static "unread key" analysis will keep flagging it. That flag is expected and should be
  dismissed, not acted on.
- The generators' sole hide signals stay `is_hide_tier`, `hide_at_strictness`, and (for
  leveling) `leveling_selection` — keeping `hideable` out of them is what preserves parity.
