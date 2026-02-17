# Inventory & persistence integrity – 2026-02-06

### [Decision 1]: Locked axe message shows which chests drop the axe
**Timestamp (UTC):** 2026-02-06T20:00:00Z
**Scope:** `index.ts` (handleLockedAxeClick), imports from `src/game` (CHESTS,
RARITY_DISPLAY_NAMES)
**Change Summary:** Replaced the generic "Open chests to get axes — then you can
equip them here" with a concrete hint: axe name, rarity, and which chest tiers
can drop it with percentages (e.g. "Ruby Axe (Exotic) — found in: Epic Chest
(1%), Mythic Chest (4%).").
**Rationale:** Players who already have axes (e.g. Golden) were confused when
clicking a locked axe (e.g. Ruby) and getting a message that implied they
hadn't opened chests. The new message is actionable and respects progression.
**Alternatives Considered:**
- Keep generic message — Rejected: user feedback that it doesn't make sense.
- Only show rarity — Rejected: chest tier + % is more useful.
**Trade-offs / Risks:**
- Slightly longer chat lines; acceptable for clarity.
**Follow-ups / TODOs:**
- None.
**Source Prompt(s):** "Golden axe is in my inventory and it says ruby axe is
locked open chests then you can equip how does that make any sense"

---

### [Decision 2]: Single atomic save when opening a chest
**Timestamp (UTC):** 2026-02-06T20:05:00Z
**Scope:** `index.ts` (handleOpenChest)
**Change Summary:** After rolling loot and applying rewards with
applyChestRewards(playerData, results), we now persist ownedAxes, shards, and
stats in one PlayerManager.savePlayerData() call instead of calling grantAxe(),
awardShards(), and incrementChestsOpened() which each did load-then-save.
**Rationale:** HYTOPIA setPersistedData uses shallow merge and is async.
Multiple rapid saves (e.g. Emerald perk double roll or fast chest opens) could
read stale data; the second save could overwrite the first and drop an axe from
ownedAxes while equippedAxe remained, causing "golden axe locked" despite
equipped.
**Alternatives Considered:**
- Await setPersistedData between each call — Not used: API may not expose
  promise; batching is simpler.
- Keep multiple saves — Rejected: root cause of desync.
**Trade-offs / Risks:**
- All chest-reward fields updated in one write; no risk of partial apply since
  applyChestRewards already mutates the same object we persist.
**Follow-ups / TODOs:**
- None.
**Source Prompt(s):** "why the golden axe in my inventory is locked" / "power and
shards and inventory stayed when i reloaded" (persistence working but ownedAxes
desync)

---

### [Decision 3]: Data integrity fix on player join
**Timestamp (UTC):** 2026-02-06T20:10:00Z
**Scope:** `index.ts` (PlayerEvent.JOINED_WORLD handler)
**Change Summary:** After loading player data, if the player has an
equippedAxe that exists in AXES but is not in ownedAxes, we add that axe to
ownedAxes (count 1) and save. Log a console warning for debugging.
**Rationale:** Repairs existing desyncs (e.g. equipped golden, ownedAxes
missing golden) so the inventory panel and HUD stay consistent without manual
fix. One-time repair on join is low-cost and prevents "locked" for axes the
player clearly has equipped.
**Alternatives Considered:**
- Downgrade equippedAxe to wooden if not owned — Rejected: would feel like
  losing progress.
- No auto-fix, document /give — Rejected: poor UX for existing players.
**Trade-offs / Risks:**
- Edge case: if someone had corrupted data with an invalid equippedAxe, we
  only add to ownedAxes when AXES[id] exists, so no bad keys.
**Follow-ups / TODOs:**
- None.
**Source Prompt(s):** Same as Decision 2 (golden axe locked with power/shards
persisting).

---

### [Decision 4]: Reconnect sends full state and axe definitions
**Timestamp (UTC):** 2026-02-06T20:15:00Z
**Scope:** `index.ts` (PlayerEvent.RECONNECTED_WORLD handler)
**Change Summary:** After player.ui.load('ui/index.html'), we now call
sendUIStateUpdate(player, true) after a 500ms delay so the reconnected client
receives stateUpdate (power, shards, equippedAxe, ownedAxes, collectedChests)
and allAxes definitions.
**Rationale:** Previously the reconnect handler only reloaded the UI HTML;
gameState was never repopulated, so inventory/HUD could appear empty or stale
after reconnect.
**Alternatives Considered:**
- Rely on client to request state — Rejected: no such request path today.
- Shorter delay — Rejected: 500ms matches initial join; avoids race with UI
  load.
**Trade-offs / Risks:**
- Same 500ms delay as join; acceptable for reconnect UX.
**Follow-ups / TODOs:**
- None.
**Source Prompt(s):** Implemented alongside persistence fixes for consistent
post-join and post-reconnect behavior.
