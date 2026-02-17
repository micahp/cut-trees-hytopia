### [Decision 1]: Cap wooden axe chop radius to 3 max
**Timestamp (UTC):** 2026-02-04T00:00:00Z
**Scope:** src/systems/choppingSystem.ts
**Change Summary:** Added a cap of 3 to the search radius when using the wooden axe, while allowing
special axes to retain their full `areaRadius + 1` range for tree detection.
**Rationale:** The fallback collision detection was allowing the default wooden axe to chop trees up
to 5 squares away, which felt wrong for the starter tool. Special axes (stone, iron, golden, diamond,
ruby, sapphire, emerald) are designed to have extended reach as part of their progression value.
**Alternatives Considered:**
- Global cap for all axes — rejected because it would nerf special axes unnecessarily
- Cap only in fallback path (no raycast hit) — rejected for simplicity; consistent behavior is better
**Trade-offs / Risks:**
- Wooden axe users may notice reduced reach if they had grown accustomed to the longer range
- The Math.min has negligible performance impact
**Follow-ups / TODOs:**
- Consider if stone axe should also have a reduced cap (currently uses full 3.0 areaRadius)
- Monitor player feedback on reach feel
**Source Prompt(s):** "let's max the rayasting chop distance to 3 square radius 5 is too high" and
"actually those special axes are fine to have a higher distance. but i know with the regular axe we
had a backup collision decetion thing that can chop wood up to 5 squares away but for the default
axe it should 3 max"
