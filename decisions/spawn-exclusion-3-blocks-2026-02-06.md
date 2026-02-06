### [Decision 1]: Spawn exclusion reduced to 3 blocks
**Timestamp (UTC):** 2026-02-06T00:00:00Z
**Scope:** `src/game/worldGeneration.ts`
**Change Summary:** Reduced tree spawn exclusion radius from 8 blocks to 3 blocks so trees
start generating closer to the player spawn. Players no longer need to walk as far to start
cutting.
**Rationale:** With an 8-block exclusion, the clearing felt too large and players had to
walk too far to reach the first trees. A 3-block exclusion keeps trees off the immediate
spawn (no collision on spawn) while bringing the forest edge in so cutting can start
quickly.
**Alternatives Considered:**
- Keep 8 blocks, add “first tree” hint — Rejected: doesn’t fix the distance.
- 2 blocks — Rejected: risk of trees too close and visual clutter at spawn.
- Configurable radius — Deferred; constant is sufficient for current single-spawn setup.
**Trade-offs / Risks:**
- Slightly more trees removed near center (~π·9 vs π·64 positions); negligible.
- If spawn point moves, exclusion center (0,0) must stay in sync.
**Follow-ups / TODOs:**
- None.
**Source Prompt(s):** "player has too much space now between him and trees… player only
needs trees to not spawn within like 3 blocks of the player. that's where the trees
should start generating"
