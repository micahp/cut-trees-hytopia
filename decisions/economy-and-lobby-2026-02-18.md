# Economy code review fixes & lobby platform expansion – 2026-02-18

### [Decision 1]: Batch tree-chop rewards into single atomic save
**Timestamp (UTC):** 2026-02-18T00:00:00Z
**Scope:** `src/systems/playerManager.ts`, `src/systems/treeManager.ts`
**Change Summary:** Added `PlayerManager.awardTreeChopRewards(player, power,
shards)` — single load/mutate/save updating power, shards, treesChopped,
totalShardsClaimed, and shardsFromTrees atomically. Replaced three separate
load/save cycles per chop in TreeManager with one call.
**Rationale:** Three load/save cycles per chop (power, shards, stats) multiplied
with AoE axes and created stale-stats race conditions. Single atomic save is
correct and faster.
**Alternatives Considered:**
- Keep separate awardPower / awardShards / incrementTreesChopped per chop —
  Rejected: race conditions and extra I/O.
**Trade-offs / Risks:**
- Individual awardPower / awardShards / incrementTreesChopped remain for
  non-chop use (chat commands, chest rewards).
**Follow-ups / TODOs:**
- None.
**Source Prompt(s):** Economy code review (from 2/17 context); triple save per
chop fix.

---

### [Decision 2]: Add floating chop reward popup (power + shards)
**Timestamp (UTC):** 2026-02-18T00:05:00Z
**Scope:** `index.ts` (chopReward event in onTreeChopped), `src/ui/index.html`
(CSS .chop-reward-container/.chop-reward, HTML container, showChopReward())
**Change Summary:** Server sends chopReward event with power and shards on each
tree chop. Client renders a floating popup that animates upward and fades out
over 1s. Green for power, blue for shards; hidden in lobby mode.
**Rationale:** Economy tuning doc requires "every chop = visible shard gain" for
retention. Single combined popup avoids visual clutter.
**Alternatives Considered:**
- Separate popups for power vs shards — Rejected: clutter.
- No popup, HUD only — Rejected: doc requirement.
**Trade-offs / Risks:**
- None significant.
**Follow-ups / TODOs:**
- None.
**Source Prompt(s):** Economy code review; "+X Power +X Shards" visible on chop.

---

### [Decision 3]: Add stats.shardsFromTrees analytics field
**Timestamp (UTC):** 2026-02-18T00:10:00Z
**Scope:** `src/game/playerData.ts`, `src/systems/playerManager.ts`
**Change Summary:** Added shardsFromTrees to PlayerData.stats type, defaults,
repairPlayerData validation, and awardTreeChopRewards. Existing players get 0
via schema migration spread.
**Rationale:** Two-stream economy (trees vs duplicate axes) requires independent
tuning; can't tune what you can't measure. Duplicate-axe shards derivable as
totalShardsClaimed - shardsFromTrees.
**Alternatives Considered:**
- Derive from existing fields only — Rejected: not separable.
**Trade-offs / Risks:**
- None.
**Follow-ups / TODOs:**
- None.
**Source Prompt(s):** Economy code review; analytics for tree vs chest shards.

---

### [Decision 4]: Expand lobby to 25x25 square
**Timestamp (UTC):** 2026-02-18T00:15:00Z
**Scope:** `src/systems/lobbyGameRouter.ts`
**Change Summary:** LOBBY_HALF_W 5→12, LOBBY_HALF_L 14→12 (25x25). Walls on all
four edges. Pad center z=12→10; spawn z=-13→-7; LOBBY_SPAWN_ROTATION 180° Y;
camera.lookAtPosition toward pad on join and /lobby return.
**Rationale:** Need room for 8–10 concurrent players plus future features
(leaderboard, shop). 25x25 = 625 blocks gives ample space without being
wastefully large.
**Alternatives Considered:**
- Keep 11x29 runway — Rejected: too cramped.
- Larger than 25x25 — Rejected: unnecessary for current scope.
**Trade-offs / Risks:**
- Player model still faces camera (default entity -Z vs camera); deferred to
  dedicated lobby orientation pass.
**Follow-ups / TODOs:**
- P1: Rotate entire lobby layout (swap pad/spawn Z) so entity facing aligns
  with pad.
**Source Prompt(s):** Expand lobby platform for 8–10 players and future features.

---

### [Decision 5]: Defer lobby orientation fix
**Timestamp (UTC):** 2026-02-18T00:20:00Z
**Scope:** `src/systems/lobbyGameRouter.ts`, `index.ts`
**Change Summary:** No code change; documented known issue. Player character
faces camera instead of away; fixing requires holistic pass (swap pad/spawn Z,
AABB, camera).
**Rationale:** Quick rotation attempts broke the layout. Holistic pass not
blocking other work.
**Alternatives Considered:**
- Fix in this session — Rejected: time and risk of further breakage.
**Trade-offs / Risks:**
- Minor UX issue until fixed.
**Follow-ups / TODOs:**
- Dedicated lobby orientation pass (P1).
**Source Prompt(s):** Make players face teleport pad on spawn; known issue in
context summary.
