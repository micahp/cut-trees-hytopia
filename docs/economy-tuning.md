# Economy Tuning: Research-Backed Targets for Retention & Engagement

Design targets for Cut Trees economy pacing, shard earn rates, and shop integration—grounded in industry retention research, operant conditioning, and F2P best practices.

---

## 1. Research Summary: What Drives Addictiveness & Retention

### First Moments (0–2 minutes)

- **50% of Roblox players churn within 2 minutes** if the opening feels flat or unclear. (Spaceport)
- **First 10 seconds** are decisive: players need clarity on what to do, why it's exciting, and **a small reward within reach**. (Spaceport, Game Developer)
- **Immediate feedback** (<100ms) feels instantaneous and confirms player agency.

**Implication:** First tree chop must award shards immediately. No gating. Every chop = visible shard gain.

### First Session (9–20 minutes)

- Games with **first session >9 minutes** average **31% Day 1 retention** vs 20% for <9 minutes. (Game Developer)
- Optimal first session: **10–20 minutes**. Median first session across games: 9 minutes.
- **5 sessions/day × 10 min each** is a sustainable F2P target. (Free-to-Play Cookbook)

**Implication:** Players should feel meaningful shard progress within the first session. First "small win" (e.g., a few upgrade clicks or a tiny shop item) should be reachable.

### Variable Ratio Reinforcement (Skinner / Operant Conditioning)

- **Variable ratio schedules** (unpredictable rewards) produce the **highest motivation** and **resistance to extinction**. (Skinner; Andrew Chen; Learning-Theories)
- **50% variable ratio** is particularly potent: players never know when the next reward will come.
- **Near-miss effects** amplify motivation—"next chest could be the one."
- Game examples: loot drops, chest RNG, mystery boxes, spin wheels.

**Implication:** Keep **chest duplicate → shards** as the variable-ratio stream. Add **tree chop → shards** as the predictable base. Dual streams = predictable progression + unpredictable dopamine spikes.

### 3X Rule (Feature Reinforcement)

- Introduce new mechanics **at least 3 times** paired with rewards for retention. (Spaceport)
- Repetition + reward = second nature.

**Implication:** Shard gain from chopping should reinforce the loop consistently. First axe upgrade (25 shards) should be achievable early to teach the sink.

### Incremental Game Pacing

- **Exponentially longer** optimal wait times for different reward tiers match naturally decaying engagement. (Eric Guan, Machinations)
- Fast loops: 20-min caps for engaged players; slower: 5 hr, 2 days for passive players.
- **Content gating** reveals features progressively rather than all at once.

**Implication:** Cheapest shop item = early gate. Mid-tier items = 5–10 hr. Legendary = 50+ hr for long-term chase.

---

## 2. Cut Trees Formula (Reference)

From Roblox Cut Trees:

```
Coins per Tree = Base Value × Level Multiplier × World Bonus
```

- **Base Value:** per-world (Forest ~100–200, Lava ~500–800, World 3 ~1.5k–2.5k, World 4 5k+).
- **Level Multiplier:** permanent progression (2×, 3×, 5× steps).
- **World Bonus:** world scaling.

We mirror this with **Shards per Tree** for our primary spendable currency.

---

## 3. Our Shard Economy: Two Streams

| Stream              | Source                     | Schedule              | Role                          |
|---------------------|----------------------------|------------------------|-------------------------------|
| **Predictable**     | Tree chops                 | Every chop             | Base income, habit loop       |
| **Variable**        | Duplicate axe from chests  | Unpredictable          | Dopamine spikes, "one more"   |

Both streams feed the same **shards** currency.

---

## 4. Shards-per-Tree Formula (v1)

```
Shards per Tree = Base(tier) × World Multiplier
```

- **Base(tier):** tree tier determines base shards.
- **World Multiplier:** Forest 1×, Lava 3× (matches power scaling).

### Tier Base Values (v1)

| Tier | Tree types          | Base shards | Rationale                         |
|------|---------------------|-------------|-----------------------------------|
| 1    | oak_small, pine_small   | 1  | Frequent, low-effort chops        |
| 2    | oak_medium, pine_medium | 2  | Steady progression feel            |
| 3    | oak_big, pine_big, palm | 4  | Big trees = bigger reward         |
| 4    | (same as tier 3)       | 4  | Consistency                        |

Weighted mix (≈40% t1, 30% t2, 30% t3): **~2.1 shards/tree** average in Forest.

### World Multipliers

| World  | Shard multiplier | Power multiplier | HP multiplier |
|--------|------------------|------------------|---------------|
| Forest | 1×               | 1×               | 1×            |
| Lava   | 3×               | 3×               | 10×           |

Lava: harder (10× HP) but 3× shards per chop when you succeed.

---

## 5. Time-to-Reward Targets (Research-Aligned)

### Target: First Shop Purchase (10,000 shards)

- **Goal:** Reachable in **2.5–4 hours** of active chopping for an engaged player.
- **Rationale:** Multiple sessions create a return habit. Too fast = trivial; too slow = frustration.

**Math:**

- Sustained chops: ~30–40 trees/min (with movement, respawns, AoE).
- Avg 2.1 shards/tree × 35 trees/min ≈ **74 shards/min**.
- 10,000 ÷ 74 ≈ **135 min ≈ 2.25 hr** (optimistic).
- With early-game slowness (wooden axe, learning): ~25 trees/min → **52 shards/min** → 10,000 in **~3.2 hr**.

**Verdict:** 10,000 for Basic Bomb is **achievable in 2.5–4 hr** with the above base values. Aligns with research.

### Target: First Axe Upgrade (25 shards)

- **Goal:** Within **first 10–15 minutes** of play.
- **Rationale:** 3X Rule—teach the upgrade sink early. 25 ÷ 2.1 ≈ 12 trees. At 25 trees/min ≈ 30 sec. With slower start: 2–3 min.
- **Verdict:** Achievable in first session. Good.

### Target: Walk Speed Potion (25,000 shards)

- **Goal:** ~8–12 hours cumulative.
- **Rationale:** Mid-tier reward. 25,000 ÷ 74 ≈ 338 min ≈ 5.6 hr (optimistic). With variance: 8–12 hr feels right.

### Target: Mega Bomb (1,000,000 shards)

- **Goal:** **50+ hours** (long-term chase).
- **Rationale:** Incremental-game pacing. Top tier = prestige. 1M ÷ 74 ≈ 13,500 min ≈ 225 hr at base rate. With duplicates, game passes, better axes: 50–100 hr for committed players. Keeps a long chase.

---

## 6. Shop Price Recalibration (Optional)

If playtesting shows 10,000 is too fast or too slow, use this table to preserve **time-to-reward** while changing prices:

| Target time    | Shards (at 74/min) |
|----------------|--------------------|
| 15 min         | ~1,100             |
| 1 hour         | ~4,400             |
| 2.5 hours      | ~11,000            |
| 4 hours        | ~17,800            |
| 8 hours        | ~35,500            |
| 12 hours       | ~53,300            |
| 50 hours       | ~222,000           |

Current prices (10k, 25k, 80k, 100k, 160k, 1M) map to roughly 2–4 hr, 6 hr, 18 hr, 22 hr, 36 hr, 225 hr at base tree rate. Duplicate shards from chests will shorten these.

---

## 7. Duplicate Shards: Keep Variable Ratio

Existing `SHARDS_FOR_DUPLICATE` stays as the **variable-ratio** stream:

| Rarity  | Shards |
|---------|--------|
| Common  | 1      |
| Rare    | 3      |
| Epic    | 8      |
| Mythic  | 20     |
| Exotic  | 60     |

No change. This provides unpredictable bonuses and keeps chest openings exciting.

---

## 8. Implementation Checklist

- [ ] Add `shardReward` (or `shardBase`) to tree definitions / `applyWorldMultipliers`.
- [ ] In `TreeManager.chopTree`, call `PlayerManager.awardShards(player, shardAmount)`.
- [ ] UI: show "+X Shards" popup on tree chop (like "+X Power").
- [ ] Optional: `stats.shardsFromTrees` for analytics (separate from `totalShardsClaimed` if desired).

---

## 9. References

| Source                         | Key point                                      |
|--------------------------------|------------------------------------------------|
| Spaceport (Roblox)             | 50% churn in 2 min; small reward in first 10s  |
| Game Developer                 | First session >9 min → 31% D1 retention        |
| Free-to-Play Cookbook          | 5 sessions/day × 10 min; D7 >10%              |
| Andrew Chen / Skinner          | Variable ratio → highest engagement            |
| Machinations / Eric Guan       | Incremental pacing; tiered wait times          |
| Cut Trees community guide      | Coins = Base × Level Mult × World              |

---

## 10. Glossary

| Term              | Meaning                                                       |
|-------------------|---------------------------------------------------------------|
| Predictable stream| Shards from tree chops (every chop)                            |
| Variable stream   | Shards from duplicate axes (unpredictable chest RNG)           |
| Base(tier)        | Shards per tree before world multiplier                       |
| Time-to-reward    | Cumulative playtime to reach a specific shard threshold       |
