### [Decision 1]: Show what’s needed to equip when clicking locked axe
**Timestamp (UTC):** 2026-02-06T00:00:00Z
**Scope:** `src/ui/index.html`, `index.ts`
**Change Summary:** When the player clicks a locked axe in the inventory, the client
sends `lockedAxeClick` with the axe id; the server replies with a chat message
explaining that they need to obtain the axe from opening chests to equip it.
**Rationale:** Locked axes were dimmed with a "🔒 Locked" badge but had no click
feedback. Players need to know how to unlock (get the axe from chests). Reusing the
existing chat channel keeps the implementation simple and consistent with other
feedback.
**Alternatives Considered:**
- Tooltip on hover — Rejected: user asked for feedback "when they click at least".
- Modal or inline panel — Rejected: chat message is lighter and doesn’t require new
  UI.
**Trade-offs / Risks:**
- Message is generic ("Open chests to get axes"); sufficient for current single
  unlock path.
**Follow-ups / TODOs:**
- None.
**Source Prompt(s):** "when it says an axe is locked, we should say what they need to
be able to equip it when they click at least"
