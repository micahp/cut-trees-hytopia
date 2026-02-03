/**
 * Loot rolling system for chest rewards.
 * Handles rarity rolls, axe selection, duplicates → shards conversion.
 */

import type { AxeId } from "./axes";
import { AXES } from "./axes";
import type { ChestTier } from "./chests";
import { CHESTS } from "./chests";
import type { Rarity } from "./rarity";
import type { PlayerData } from "./playerData";

type Weighted<T extends string> = Record<T, number>;

/**
 * Roll from a weighted table
 */
function rollWeighted<T extends string>(weights: Weighted<T>, rng: () => number): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  
  if (total <= 0) {
    throw new Error("Invalid weight table: total weight must be > 0");
  }

  let r = rng() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  
  return entries[entries.length - 1][0];
}

/**
 * Axe pool by rarity
 * - Common → Wooden
 * - Rare → Stone
 * - Epic → Iron (75%) / Golden (25%)
 * - Mythic → Diamond
 * - Exotic → Ruby (34%) / Sapphire (33%) / Emerald (33%)
 */
const AXE_POOL_BY_RARITY: Record<Rarity, Weighted<AxeId>> = {
  common: { wooden: 100, stone: 0, iron: 0, golden: 0, diamond: 0, ruby: 0, sapphire: 0, emerald: 0 },
  rare: { wooden: 0, stone: 100, iron: 0, golden: 0, diamond: 0, ruby: 0, sapphire: 0, emerald: 0 },
  epic: { wooden: 0, stone: 0, iron: 75, golden: 25, diamond: 0, ruby: 0, sapphire: 0, emerald: 0 },
  mythic: { wooden: 0, stone: 0, iron: 0, golden: 0, diamond: 100, ruby: 0, sapphire: 0, emerald: 0 },
  exotic: { wooden: 0, stone: 0, iron: 0, golden: 0, diamond: 0, ruby: 34, sapphire: 33, emerald: 33 },
};

/**
 * Shard values for duplicate axes
 */
export const SHARDS_FOR_DUPLICATE: Record<Rarity, number> = {
  common: 1,
  rare: 3,
  epic: 8,
  mythic: 20,
  exotic: 60,
};

/**
 * Shard costs for upgrades
 */
export const SHARD_COSTS = {
  /** Upgrade axe damage by +5% */
  DAMAGE_UPGRADE: 25,
  /** Upgrade axe area by +0.2m */
  AREA_UPGRADE: 35,
  /** Reroll Emerald perk (optional) */
  EMERALD_REROLL: 50,
} as const;

/**
 * Result of opening a chest
 */
export type ChestOpenResult =
  | { kind: "axe"; axeId: AxeId; rarity: Rarity; isNew: true }
  | { kind: "shards"; amount: number; sourceAxeId: AxeId; rarity: Rarity };

/**
 * Open a chest and get rewards.
 * Handles Emerald perk (extra roll chance) and duplicate conversion.
 */
export function openChest(
  chestTier: ChestTier,
  playerData: PlayerData,
  rng: () => number = Math.random
): ChestOpenResult[] {
  const chest = CHESTS[chestTier];
  const equipped = AXES[playerData.equippedAxe];
  const extraRollChance = equipped.perks?.extraRollChance ?? 0;

  const results: ChestOpenResult[] = [];
  
  // Base roll + possible extra roll from Emerald perk
  const rollCount = 1 + (rng() < extraRollChance ? 1 : 0);

  for (let i = 0; i < rollCount; i++) {
    // Roll rarity from chest drop table
    const rarity = rollWeighted(chest.dropTable, rng);
    
    // Roll specific axe from rarity pool
    const axeId = rollWeighted(AXE_POOL_BY_RARITY[rarity], rng);
    
    // Check if player already owns this axe
    const ownedCount = playerData.ownedAxes[axeId] ?? 0;

    if (ownedCount > 0) {
      // Duplicate: convert to shards
      const shards = SHARDS_FOR_DUPLICATE[rarity];
      results.push({
        kind: "shards",
        amount: shards,
        sourceAxeId: axeId,
        rarity,
      });
    } else {
      // New axe
      results.push({
        kind: "axe",
        axeId,
        rarity,
        isNew: true,
      });
    }
  }

  return results;
}

/**
 * Apply chest rewards to player data (mutates playerData)
 */
export function applyChestRewards(
  playerData: PlayerData,
  results: ChestOpenResult[]
): void {
  for (const result of results) {
    if (result.kind === "axe") {
      playerData.ownedAxes[result.axeId] = 1;
    } else {
      playerData.shards += result.amount;
      playerData.stats.totalShardsClaimed += result.amount;
    }
  }
  
  playerData.stats.chestsOpened += 1;
}

/**
 * Attempt to upgrade axe damage (+5%)
 * Returns true if successful, false if insufficient shards
 */
export function upgradeDamage(playerData: PlayerData, axeId: AxeId): boolean {
  if (playerData.shards < SHARD_COSTS.DAMAGE_UPGRADE) {
    return false;
  }
  
  if (!playerData.ownedAxes[axeId]) {
    return false;
  }
  
  playerData.shards -= SHARD_COSTS.DAMAGE_UPGRADE;
  const currentBonus = playerData.axeDamageBonus[axeId] ?? 0;
  playerData.axeDamageBonus[axeId] = currentBonus + 0.05;
  
  return true;
}

/**
 * Attempt to upgrade axe area (+0.2m)
 * Returns true if successful, false if insufficient shards
 */
export function upgradeArea(playerData: PlayerData, axeId: AxeId): boolean {
  if (playerData.shards < SHARD_COSTS.AREA_UPGRADE) {
    return false;
  }
  
  if (!playerData.ownedAxes[axeId]) {
    return false;
  }
  
  playerData.shards -= SHARD_COSTS.AREA_UPGRADE;
  const currentBonus = playerData.axeAreaBonus[axeId] ?? 0;
  playerData.axeAreaBonus[axeId] = currentBonus + 0.2;
  
  return true;
}

/**
 * Format chest results for display
 */
export function formatChestResults(results: ChestOpenResult[]): string[] {
  return results.map(result => {
    if (result.kind === "axe") {
      const axe = AXES[result.axeId];
      return `🎉 NEW: ${axe.name} (${result.rarity})`;
    } else {
      const axe = AXES[result.sourceAxeId];
      return `💎 +${result.amount} Shards (duplicate ${axe.name})`;
    }
  });
}
