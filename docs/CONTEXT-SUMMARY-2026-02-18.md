# Cut Trees – Context Summary (2026-02-18)

Purpose: Context summary for the economy code review fixes and lobby platform expansion session.

---

## 1. Session Goals

1. Review and fix all issues from the shard-per-tree-chop code review (carried over from 2/17 context).
2. Expand the lobby platform from a narrow runway to a square that supports 8-10 players and future features (leaderboard, shop).
3. Make players face the teleport pad on spawn.

---

## 2. Economy Code Review Fixes (from 2/17, committed today)

### 2.1 Triple save per chop → single atomic save

**Problem:** `TreeManager.chopTree()` made 3 separate `loadPlayerData()` + `savePlayerData()` calls per chop (power, shards, stats). With AoE axes this multiplied further and created stale-stats race conditions.

**Fix:** Added `PlayerManager.awardTreeChopRewards(player, power, shards)` — single load/mutate/save updating `power`, `shards`, `treesChopped`, `totalShardsClaimed`, and `shardsFromTrees` atomically.

**Files:** `src/systems/playerManager.ts`, `src/systems/treeManager.ts`

### 2.2 Stale `awardShards` docstring

Updated from "from duplicate axes" to "from tree chops or duplicate axes".

**File:** `src/systems/playerManager.ts`

### 2.3 "+X Power +X Shards" floating popup on chop

**Problem:** Economy tuning doc requires "every chop = visible shard gain" but shards updated silently in HUD.

**Fix:** Server sends `chopReward` event with `power` and `shards` on each tree chop. Client renders a floating popup that animates upward and fades out over 1s. Green for power, blue for shards, matching HUD colors. Hidden in lobby mode.

**Files:** `index.ts` (event in `onTreeChopped`), `src/ui/index.html` (CSS `.chop-reward-container`/`.chop-reward`, HTML container, JS `showChopReward()` handler)

### 2.4 `stats.shardsFromTrees` analytics field

Added to `PlayerData.stats` type, defaults, `repairPlayerData` validation, and `awardTreeChopRewards`. Existing players get 0 via schema migration spread. Duplicate-axe shards derivable as `totalShardsClaimed - shardsFromTrees`.

**Files:** `src/game/playerData.ts`, `src/systems/playerManager.ts`

---

## 3. Lobby Platform Expansion

### 3.1 Platform size: 11x29 runway → 25x25 square

**Problem:** The lobby was a narrow 11-block-wide runway — too cramped for multiple players and no room for future features like leaderboard, shop NPCs, etc.

**Fix:** Changed `LOBBY_HALF_W` from 5 to 12, `LOBBY_HALF_L` from 14 to 12, producing a 25x25 square platform. Walls now on all four edges (previously only 3 sides).

**File:** `src/systems/lobbyGameRouter.ts`

### 3.2 Teleport pad repositioned

Pad center moved from z=12 to z=10 (same 5x5 size), giving a 2-block border to the +Z wall edge.

### 3.3 Player spawn rotation and camera

Added `LOBBY_SPAWN_ROTATION` quaternion (`{ x: 0, y: 1, z: 0, w: 0 }` — 180 degree Y rotation) and `camera.lookAtPosition()` toward the pad center on both join and `/lobby` return paths. Spawn position moved to z=-7 (5 blocks from back wall) to prevent camera clipping into the wall.

**Known issue — deferred:** The player character faces the camera instead of away from it. The default entity facing is -Z, so the 180 degree rotation points the model toward -Z but the 3rd-person camera ends up showing the player's face. Fixing this properly requires rotating the entire lobby layout (swap pad and spawn Z positions) so the pad is at -Z and spawn is at +Z, aligning with the default entity/camera orientation. **Deferred to a dedicated lobby orientation pass.**

**Files:** `src/systems/lobbyGameRouter.ts` (exports `LOBBY_SPAWN_ROTATION`, `PAD_Z_CENTER`), `index.ts` (import + spawn calls + `camera.lookAtPosition`)

---

## 4. Change Log

| Layer | Filepath | Change |
|-------|----------|--------|
| Systems | `src/systems/playerManager.ts` | Add `awardTreeChopRewards()` batch method; fix `awardShards` docstring |
| Systems | `src/systems/treeManager.ts` | Replace 3 separate award calls with single `awardTreeChopRewards()` |
| Game Config | `src/game/playerData.ts` | Add `stats.shardsFromTrees` field, default, and repair validation |
| Entry | `index.ts` | Send `chopReward` UI event; import+use `LOBBY_SPAWN_ROTATION` and `PAD_Z_CENTER`; `camera.lookAtPosition` on spawn |
| UI | `src/ui/index.html` | Chop reward popup: CSS animation, HTML container, JS handler |
| Systems | `src/systems/lobbyGameRouter.ts` | Expand platform to 25x25; walls on all edges; pad at z=10; spawn at z=-7; add `LOBBY_SPAWN_ROTATION`; export `PAD_Z_CENTER` |

---

## 5. Lobby Geometry Reference

| Constant | Old | New | Notes |
|----------|-----|-----|-------|
| `LOBBY_HALF_W` | 5 (11 wide) | 12 (25 wide) | Square platform |
| `LOBBY_HALF_L` | 14 (29 long) | 12 (25 long) | Square platform |
| `PAD_Z_CENTER` | 12 | 10 | 2-block border to +Z wall |
| `LOBBY_SPAWN` z | -13 | -7 | 5 blocks from -Z wall (camera clearance) |
| `LOBBY_SPAWN_ROTATION` | N/A | `{x:0, y:1, z:0, w:0}` | 180 deg Y — see known issue above |

---

## 6. Outstanding Work

1. **Rebuild and commit all changes** — Pending — Economy fixes + lobby expansion + context summary not yet committed.
2. **Fix lobby orientation** — P1 — Rotate entire lobby layout so default entity facing (-Z) points toward the pad. Swap pad/spawn Z positions, update walls, AABB, and camera. See section 3.3 known issue.
3. **Playtest and tune `SHARD_BASE_BY_TIER`** — P1 — Validate 2.5-4 hr target for first 10k shards.
4. **Implement Item Shop** — P0 — Wire `shopItems.ts`, purchase handlers, and UI per `docs/economy-and-shops.md`.
5. **Lobby features** — P2 — Leaderboard, shop NPC, decorations on the expanded platform.

---

## 7. Decision Log

- **Decision:** Batch tree-chop rewards into single save. **Rationale:** 3 load/save cycles per chop is wasteful and creates stale-stats race. Single atomic save is correct and faster. **Tradeoff:** Individual `awardPower`/`awardShards`/`incrementTreesChopped` still exist for non-chop use (chat commands, chest rewards).
- **Decision:** Add floating chop reward popup showing both power and shards. **Rationale:** Economy tuning doc requires "every chop = visible shard gain" per retention research. Single combined popup avoids visual clutter.
- **Decision:** Add `shardsFromTrees` stat. **Rationale:** Two-stream economy requires independent tuning; can't tune what you can't measure.
- **Decision:** Expand lobby to 25x25 square. **Rationale:** Need room for 8-10 concurrent players plus future features (leaderboard, shop). 25x25 = 625 blocks gives ample space without being wastefully large.
- **Decision:** Defer lobby orientation fix. **Rationale:** Quick rotation attempts broke the layout. Needs a holistic pass that swaps pad/spawn Z, updates AABB bounds, and verifies camera. Not blocking other work.
