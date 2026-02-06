# Axe Orientation, Auto-Chop & Tree Sounds - Decisions Log

### [Decision 3]: Tree chopping sound effects
**Timestamp (UTC):** 2026-02-04T12:00:00Z
**Scope:** src/systems/treeManager.ts
**Change Summary:** Added positional audio for tree damage and destruction using default Hytopia SDK sounds.
**Rationale:** Audio feedback makes chopping feel more satisfying and provides clear indication of actions.
Using existing SDK sounds (`hit-wood.mp3`, `hit-woodbreak.mp3`) avoids adding custom assets and ensures
consistency with the Hytopia ecosystem.
**Alternatives Considered:**
- Custom wood chopping sounds — rejected, unnecessary when SDK has good defaults
- UI-based sounds — rejected, positional 3D audio is more immersive
**Trade-offs / Risks:**
- Multiple rapid chops may create overlapping sounds (acceptable, adds to feel)
- Sound volume tuned for proximity; may need adjustment based on playtesting
**Follow-ups / TODOs:**
- Consider adding variety by randomly selecting from multiple hit sounds
- ~~May want to add a "tree falling" animation before despawn~~ — Closed: animation was
  removed for responsiveness; see `decisions/remove-tree-fall-animation-2026-02-06.md`.
**Source Prompt(s):** "when a tree is chopped it should disappear. we need to have a sound for it. find a
sound to use in the default assets."

---

### [Decision 2]: Auto-chop UI button with keyboard shortcut
**Timestamp (UTC):** 2026-02-04T11:45:00Z
**Scope:** src/ui/index.html
**Change Summary:** Added "Auto Chop" toggle button that continuously fires chop actions at 4Hz (250ms
interval). Toggle via click or 'R' key. Visual feedback shows active state with green glow.
**Rationale:** Reduces player fatigue during extended chopping sessions. Interval of 250ms balances speed
with server-side cooldown mechanics. 'R' key provides quick keyboard access without conflicting with movement.
**Alternatives Considered:**
- Hold-to-chop (mouse hold) — rejected, less convenient for long sessions
- Faster chop rate (100ms) — rejected, may exceed server cooldown and waste inputs
- Different hotkey — 'R' chosen as intuitive ("Repeat") and not used by movement
**Trade-offs / Risks:**
- May trivialize gameplay if too powerful; balance via axe cooldowns
- Continuous input could stress server if abused; cooldown system mitigates this
**Follow-ups / TODOs:**
- Consider adding visual "swing" animation during auto-chop
- May want to auto-disable when player takes damage or moves away
**Source Prompt(s):** "there should be an auto chop button that continuously does the chopping motion."

---

### [Decision 1]: Axe orientation - blade down, outward, flat
**Timestamp (UTC):** 2026-02-04T11:30:00Z
**Scope:** src/systems/playerManager.ts
**Change Summary:** Changed axe attachment quaternion from Y-axis rotation (pointing forward) to combined
X/Y/Z rotation that positions blade pointing down with flat face horizontal. Position adjusted slightly
down and forward from hand anchor.
**Rationale:** Previous orientation had axe pointing forward like a spear. New "resting" position with
blade down is more natural for an idle stance and matches typical game conventions for held tools.
**Alternatives Considered:**
- Pure X-axis rotation (blade straight down) — rejected, looked unnatural
- 45-degree diagonal hold — rejected, user specifically requested "flat"
**Trade-offs / Risks:**
- Quaternion values (0.5, 0.5, -0.5, 0.5) are approximate; may need fine-tuning per model
- Different axe models may need individual offset adjustments
**Follow-ups / TODOs:**
- Test with all axe tiers to ensure consistent appearance
- Consider adding swing animation that rotates axe during chop
**Source Prompt(s):** "weapon should be facing down and outward and flat."
