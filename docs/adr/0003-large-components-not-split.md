# ADR-0003: Some large view components are deliberately not split

## Status
Accepted.

## Context
A prior refactor pass split several god-components into bone + presentational children, but
stopped short on others because splitting them further would have required inventing
`>20`-prop pass-through interfaces — bad seams that add indirection without adding depth.

## Decision
`RuleManager`, `SoundBulkEditor`, `CategoryView`, and `ImportForeignFilterView` are kept
whole intentionally. Size alone is not a reason to split them. `localization.ts` being large
is likewise fine — it is a translation data table.

## Consequences
- Reviews should not recommend splitting these on line count; only a genuine deep sub-module
  (real behaviour behind a small interface) justifies extraction.
- This does not forbid all future work: if a clean seam genuinely appears — e.g. a `Filter`
  domain model that makes `CategoryView` naturally splittable — that is a new decision, not a
  violation of this one.
