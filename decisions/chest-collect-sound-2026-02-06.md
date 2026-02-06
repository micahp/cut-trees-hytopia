### [Decision 1]: Sound when collecting a chest
**Timestamp (UTC):** 2026-02-06T00:00:00Z
**Scope:** `src/systems/chestManager.ts`
**Change Summary:** Play positional audio when a player collects a chest to inventory.
Uses existing `hit-woodbreak.mp3` at the chest position for immediate feedback.
**Rationale:** Collecting a chest had no audio cue; adding a short break/open-style sound
reinforces the action and matches the pattern used for tree chop (positional Audio in
world). Reusing an existing asset keeps the change small; a dedicated chest-loot asset
can be swapped in later.
**Alternatives Considered:**
- UI-only (non-positional) sound — Rejected: world actions use 3D audio for consistency.
- New custom asset — Deferred: hit-woodbreak is a reasonable placeholder.
**Trade-offs / Risks:**
- Same sound as tree break; acceptable until a distinct loot sound is added.
**Follow-ups / TODOs:**
- Optional: add a dedicated chest/loot pickup sound and point uri to it.
**Source Prompt(s):** "we need a sound for collecting a chest too"
