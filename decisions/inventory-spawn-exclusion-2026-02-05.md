### [Decision 2]: Inventory UI — Overlay panel with server-validated equip
**Timestamp (UTC):** 2026-02-05T12:00:00Z
**Scope:** `index.ts`, `src/ui/index.html`
**Change Summary:** Added an Overlay UI inventory panel showing all 8 axes in a 2-column grid.
Owned axes are clickable to equip; locked axes are dimmed. Server validates ownership before
swapping the axe model. Axe definitions are sent once on first `stateUpdate` to avoid
re-sending static data every tick.
**Rationale:** Players need to see and equip their axes without chat commands. Hytopia's UI
system is HTML/CSS/JS overlays with `player.ui.sendData()` / `hytopia.sendData()` for
bidirectional communication. An overlay panel is the simplest, most maintainable approach
and matches the existing chest panel pattern. No lobby zone or NPCs needed.
**Alternatives Considered:**
- Lobby zone with 3D shop entity — Rejected: Hytopia is too young for spatial UI; adds map
  complexity for no UX gain.
- Chat command only (`/equip`) — Rejected: Already exists but not discoverable; players
  expect a visual inventory.
- React-based UI — Rejected: Overkill for 8 cards; vanilla HTML keeps the single-file
  pattern and zero build step.
**Trade-offs / Risks:**
- `allAxes` payload is ~1KB; sent once per join, negligible bandwidth.
- No pointer-lock toggle yet — player must press Escape/T to click UI (standard Hytopia
  behavior). Could add `player.ui.lockPointer(false)` on panel open later.
**Follow-ups / TODOs:**
- Add `player.ui.lockPointer(false/true)` when inventory opens/closes for smoother UX.
- Shop panel (buy axes with shards) — next priority.
- Keyboard shortcut (e.g. `I` key) to toggle inventory.
**Source Prompt(s):** "we need a way for the user to see their axes… equip an ax from their
inventory… research what a Roblox game lobby looks like… implement the lobby and the
inventory"

---

### [Decision 1]: Spawn tree exclusion — 8-block radius around origin
**Timestamp (UTC):** 2026-02-05T11:45:00Z
**Scope:** `src/game/worldGeneration.ts`
**Change Summary:** Added a squared-distance check in `tryAddTree()` that rejects any tree
within 8 blocks (XZ plane) of the player spawn point `(0, 0)`. Uses pre-computed
`SPAWN_EXCLUSION_RADIUS_SQ = 64` to avoid sqrt per call.
**Rationale:** Players spawn at `(0, 10, 0)` and were immediately colliding with trees.
An 8-block exclusion gives a comfortable clearing while keeping the tree density high
everywhere else. The check is O(1) per candidate position.
**Alternatives Considered:**
- Post-spawn despawn of nearby trees — Rejected: Would leave visible holes that refill,
  feels buggy.
- Larger exclusion (16+ blocks) — Rejected: Would carve too big a hole in the forest;
  8 blocks is ~2 seconds of walking.
- Configurable exclusion via world gen config — Considered but deferred; hardcoded constant
  is fine until we have multiple spawn points.
**Trade-offs / Risks:**
- Removes ~50-80 tree positions from the world; negligible impact on total tree count
  (typically 2000+).
- If spawn point changes, the exclusion center must be updated manually.
**Follow-ups / TODOs:**
- Extract spawn position as a named constant shared between `index.ts` and world gen.
- Consider exclusion zones for future features (portals, buildings).
**Source Prompt(s):** "I also want to make sure that within a few blocks of the user when
they spawn there's no tree directly on them"
