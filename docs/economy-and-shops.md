# Economy & Shops Design

Design document for Cut Trees economy: shards as primary currency, shop types, item tiers, and logic for future implementation.

---

## 1. Currency: Shards

**Shards** are our primary in-game currency—equivalent to "diamonds" in freemium games. They are the main spendable for progression and shop items.

- **Acquisition (two streams):**
  1. **Tree chops** — Every chop awards shards (tier-based base × world multiplier). See `docs/economy-tuning.md`.
  2. **Chest loot** — When a player gets a duplicate axe, it converts to shards (`SHARDS_FOR_DUPLICATE` in `loot.ts`).
- **Role:** Shards feel "premium" compared to Cutting Power (which is progression-only). Users spend shards to buy:
  - New worlds (unlock)
  - Potions (effects)
  - Bombs (world interaction)
  - Limited weapons (shop rotation)
  - Items in the lobby item shop

**UI implication:** Shards should be prominent (see `docs/ui-styling-review.md`)—they are the main spendable currency.

---

## 2. Shop Types Overview

| Shop | Currency | Purpose |
|------|----------|---------|
| **Item Shop** | Shards | Potions, bombs, consumables (lobby) |
| **Limited Weapons** | Shards | Rotating axe/special weapon offers |
| **Game Passes** | Robux only | Permanent boosts (2X power, 2X wood, etc.) |
| **Regular Shop** | Robux only | Pay-to-win items |

---

## 3. Item Shop (Lobby) — Shards

Purchased with **shards** in the lobby. Limited stock; restocks every 5 minutes or via instant restock (80 Robux).

### Common Tier (Base Prices)

| Item | Shard Cost | Effect |
|------|------------|--------|
| Basic Bomb | 10,000 | Destroys trees in area (TBD) |
| Walk Speed Potion | 25,000 | Temporary speed boost |
| Damage Potion | 80,000 | Temporary damage boost |
| Wood Potion | 100,000 | Temporary power/wood gain multiplier |
| Tool Speed Potion | 160,000 | Temporary cooldown reduction |
| Mega Bomb | 1,000,000 | Large-area tree clear |

### Epic Tier (5× Common)

- Same items, 5× the common price.
- Example: Walk Speed Epic = 125,000 shards.

### Legendary Tier (10× Epic = 50× Common)

- Same items, 10× the epic price (50× common).
- Example: Walk Speed Legendary = 1,250,000 shards.

### Restock

- **Timer:** Full restock every 5 minutes.
- **Instant:** 80 Robux ($0.99 equivalent) to restock immediately.
- **Limited stock:** Each item has a max quantity per restock cycle (e.g., 3–5 per item).

---

## 4. Limited Weapons Shop — Shards

Rotating shop for axes or special weapons. Bought with shards.

- **Limited stock** per item.
- **Restock:** Same 5-min timer or 80 Robux instant.
- Items are typically higher-tier axes or exclusives.

---

## 5. Game Passes — Robux Only

Permanent boosts; **no shards**. Pay-to-win adjacent but framed as "support the dev" or convenience.

| Pass | Effect |
|------|--------|
| 2X Power | Double Cutting Power gain |
| 2X Wood | Double wood/resource gain (if applicable) |
| 2X Loot | Improved chest rarity odds or double rolls |
| Chest X-Ray | See chest contents before opening (TBD) |
| Lucky Boost | Improved luck in rolls |
| Extra Lucky Boost | Additional luck tier |

---

## 6. Regular Shop — Robux Only

Standard Robux shop: exclusive cosmetics, premium axes, etc. Fully pay-to-win. No shard option.

---

## 7. New Worlds — Shards

Unlocking new worlds (e.g., World 2) costs shards. Exact amounts TBD; treated as a major progression spend.

---

## 8. Logic Recommendations

### 8.1 Data Structures

**Extend `PlayerData`** (`src/game/playerData.ts`):

```ts
// Already have:
// shards: number;

// Add when implementing shops:
// gamePasses?: Record<GamePassId, boolean>;  // e.g. { "2xPower": true }
// consumables?: Record<ConsumableId, number>;  // e.g. { "basicBomb": 2, "walkSpeedPotion": 1 }
```

**New config modules** (pure data, no side effects):

- `src/game/shopItems.ts` — Item Shop catalog: ids, names, costs by tier, effects, max stock.
- `src/game/gamePasses.ts` — Game pass ids and multipliers (2X, etc.).
- `src/game/restock.ts` — Restock intervals, base stock, tier multipliers (1x, 5x, 50x).

### 8.2 Shop Item Catalog Shape

```ts
// src/game/shopItems.ts (conceptual)
type ItemTier = "common" | "epic" | "legendary";
const TIER_MULTIPLIER: Record<ItemTier, number> = { common: 1, epic: 5, legendary: 50 };

type ShopItemId = "basicBomb" | "walkSpeedPotion" | "damagePotion" | "woodPotion" | "toolSpeedPotion" | "megaBomb";

interface ShopItemDef {
  id: ShopItemId;
  name: string;
  commonCost: number;  // base price in shards
  maxStockPerRestock: number;
  effectType: "bomb" | "potion" | ...;
  effectParams: Record<string, number>;
}
```

### 8.3 Restock Logic

- **Server-side:** Track last restock timestamp (per-world or global).
- **Timer:** Restock when `now - lastRestock >= 5 * 60 * 1000`.
- **Instant restock:** Validate Robux purchase (HYTOPIA/Platform API), then set `lastRestock = now`.
- **Stock:** Per-item, per-restock-cycle count. Decremented on purchase; reset on restock.

### 8.4 Purchase Flow

1. **Validate:** Player has enough shards (or valid Robux for Robux items).
2. **Stock:** Item in stock for current cycle.
3. **Deduct:** Shards or process Robux.
4. **Grant:** Add consumable to `PlayerData` or apply game pass.
5. **Persist:** Single `savePlayerData()` after all mutations.

### 8.5 Game Pass Multipliers

Apply in existing systems:

- **2X Power:** In `PlayerManager` when awarding power, multiply by 2 if `gamePasses["2xPower"]`.
- **2X Wood:** Same pattern for wood-related rewards.
- **2X Loot:** In `loot.ts` — extra roll, or improved rarity weights when `gamePasses["2xLoot"]`.
- **Lucky Boost:** Add a luck modifier to `rollWeighted` or similar RNG.

### 8.6 Consumables (Potions, Bombs)

- **Potions:** Temporary effects; store in `PlayerSessionData` or a transient "active effects" map with expiry.
- **Bombs:** One-shot; consume from `consumables[id]`, apply effect (e.g., tree damage in radius), decrement count.

### 8.7 HYTOPIA / Robux Integration

- Game passes and regular shop require platform purchase APIs.
- HYTOPIA may provide hooks for developer products / game passes.
- Document exact APIs when implementing; keep Robux flows behind a `purchaseWithRobux(itemId)` abstraction.

---

## 9. Implementation Order (Suggested)

1. **Config only:** Add `shopItems.ts`, `gamePasses.ts`, `restock.ts` with constants.
2. **PlayerData:** Add `gamePasses` and `consumables` (or equivalent) to schema.
3. **Restock manager:** `RestockManager` in `src/systems/` — timer, stock state, restock triggers.
4. **Shop server handlers:** `purchaseItem(itemId, tier)` (shards), `instantRestock()` (Robux check).
5. **Apply game passes:** Wire multipliers into `PlayerManager`, `loot.ts`, etc.
6. **Consumables:** Implement potion/bomb effects and session storage.
7. **Lobby UI:** Item shop front-end (when ready).

---

## 10. Glossary

| Term | Meaning |
|------|---------|
| **Shards** | Primary in-game currency; earned from duplicate axes, spent in shard shops |
| **Robux** | Platform currency; used for game passes, instant restock, regular shop |
| **Common / Epic / Legendary** | Item tiers; 1×, 5×, 50× base price |
| **Restock** | Refill shop inventory; auto every 5 min or 80 Robux instant |
| **Game Pass** | One-time Robux purchase; permanent multiplier or capability |
