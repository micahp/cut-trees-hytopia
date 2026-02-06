### [Decision 1]: Remove tree fall animation when chopped
**Timestamp (UTC):** 2026-02-06T00:00:00Z
**Scope:** `src/systems/treeManager.ts`
**Change Summary:** When a tree is chopped to zero HP, the tree entity is despawned
immediately and debris is spawned at the same position. The previous ~600ms fall
(rotation) animation was removed.
**Rationale:** The fall animation delayed the transition to debris and added no
gameplay value; players wanted quicker feedback. Replacing the tree with debris
immediately keeps the flow snappy.
**Alternatives Considered:**
- Shorten fall to ~200ms — Rejected: still adds delay; removal is simpler.
- Keep animation as optional — Rejected: not requested; single code path is clearer.
**Trade-offs / Risks:**
- Slightly less “cinematic” feel; preferred for responsiveness.
**Follow-ups / TODOs:**
- None.
**Source Prompt(s):** "we can get rid of the first animation that happens when we cut.
we don't need to transform the tree on the axes before replacing it with debris"
