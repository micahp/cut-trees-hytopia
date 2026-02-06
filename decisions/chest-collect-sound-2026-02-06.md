### [Decision 2]: Use Hytopia UI asset for chest collect sound
**Timestamp (UTC):** 2026-02-06T12:00:00Z
**Scope:** `src/systems/chestManager.ts`, `assets/audio/sfx/ui/`
**Change Summary:** Switched chest collect sound from `hit-woodbreak.mp3` to
`audio/sfx/ui/inventory-grab-item.mp3` from `@hytopia.com/assets`. File copied into
project assets so it works in production (assets/ is gitignored; sync or copy required).
**Rationale:** hit-woodbreak is a destruction sound; inventory-grab-item matches
"grabbing an item into inventory" and is the right semantic fit. Discovered via
node_modules/@hytopia.com/assets/audio/sfx/ (ui/ folder).
**Follow-ups / TODOs:** None.
**Source Prompt(s):** User asked to analyze Hytopia package sounds and pick the right one.

---

### [Decision 1]: Sound when collecting a chest
**Timestamp (UTC):** 2026-02-06T00:00:00Z
**Scope:** `src/systems/chestManager.ts`
**Change Summary:** Play positional audio when a player collects a chest to inventory.
Initially used `hit-woodbreak.mp3` at the chest position for immediate feedback.
**Rationale:** Collecting a chest had no audio cue; adding a short break/open-style sound
reinforces the action and matches the pattern used for tree chop (positional Audio in
world). Reusing an existing asset keeps the change small.
**Alternatives Considered:**
- UI-only (non-positional) sound — Rejected: world actions use 3D audio for consistency.
- New custom asset — Deferred: hit-woodbreak was placeholder; later replaced (Decision 2).
**Trade-offs / Risks:**
- Same sound as tree break was acceptable only until a distinct loot sound was added (done in Decision 2).
**Follow-ups / TODOs:**
- ~~Optional: add a dedicated chest/loot pickup sound~~ — Done: now use `inventory-grab-item.mp3`.
**Source Prompt(s):** "we need a sound for collecting a chest too"
