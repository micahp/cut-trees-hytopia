# Decision Log: Fix Spawn, HUD, and Axe Position

### [Decision 3]: Use fixed spawn height instead of raycast
**Timestamp (UTC):** 2026-02-04T05:30:00Z
**Scope:** src/systems/treeManager.ts, src/systems/chestManager.ts
**Change Summary:** Replaced raycast-based ground detection with fixed y=1 spawn height. The raycast
collision group filtering was not working as expected, causing trees to spawn floating in air.
**Rationale:** Multiple attempts to filter raycasts to only hit blocks (using CollisionGroupsBuilder
and filterGroups) failed. Since the current map terrain is uniformly at y=0, using a fixed spawn
height of y=1 is a reliable workaround that gets the game functional.
**Alternatives Considered:**
- CollisionGroupsBuilder.buildRawCollisionGroups with BLOCK filter — did not work, entities still hit
- filterPredicate callback — not fully explored, may work but adds complexity
**Trade-offs / Risks:**
- Maps with varied terrain heights will need proper raycast filtering
- Current solution is map-specific
**Follow-ups / TODOs:**
- Investigate why collision group filtering doesn't work for raycasts
- Consider asking HYTOPIA Discord for guidance on proper raycast filtering
**Source Prompt(s):** User screenshots showing floating trees, debugging session

---

### [Decision 2]: Move HUD below system buttons
**Timestamp (UTC):** 2026-02-04T05:15:00Z
**Scope:** src/ui/index.html
**Change Summary:** Changed HUD position from top: 20px to top: 90px to avoid overlapping with
HYTOPIA's built-in system buttons (logo, chat, share) in the top-left corner.
**Rationale:** User feedback showed Power/Shards/Axe HUD elements were overlapping or too close to
the system UI buttons, making it hard to read.
**Alternatives Considered:**
- Moving HUD to different corner — rejected, top-left is standard for stats
- Making HUD collapsible — overkill for this issue
**Trade-offs / Risks:** None significant
**Follow-ups / TODOs:** None
**Source Prompt(s):** "can me move the elements on the top left hud down below those three buttons"

---

### [Decision 1]: Fix axe position to appear in front of player
**Timestamp (UTC):** 2026-02-04T05:10:00Z
**Scope:** src/systems/playerManager.ts
**Change Summary:** Changed axe attachment rotation from X-axis (0.707, 0, 0, 0.707) to Y-axis
(0, 0.707, 0, 0.707) and position from (0, 0.1, 0.3) to (0.2, 0, -0.3) so axe appears in front of
the player, not behind.
**Rationale:** User reported axe appearing behind player. In HYTOPIA, -Z is forward, so positive Z
offset placed axe behind. Changed to negative Z and adjusted rotation axis.
**Alternatives Considered:**
- Different rotation quaternions — tried X-axis first, Y-axis works better
- Different position offsets — (0.2, 0, -0.3) gives good visibility
**Trade-offs / Risks:** May need per-axe-model adjustments if models have different origins
**Follow-ups / TODOs:** Test with different axe models when available
**Source Prompt(s):** "the axe should be in front not in the back of the player"
