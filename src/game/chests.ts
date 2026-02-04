/**
 * Chest definitions with spawn weights, unlock costs, and drop tables.
 * Based on Cut Trees v1 tuning sheet.
 */

import type { Rarity } from "./rarity";

export type ChestTier = "common" | "rare" | "epic" | "mythic";

export type ChestDef = {
  id: ChestTier;
  name: string;
  
  /** Model path in assets folder */
  modelUri: string;
  
  /** Drop table: what rarity does the chest roll (weights sum to 100) */
  dropTable: Record<Rarity, number>;
  
  /** Number of nearby trees player must chop to unlock */
  unlockCost: number;
  
  /** Minimum Cutting Power required to unlock (0 = no requirement) */
  powerGate: number;
  
  /** Seconds until chest respawns after being opened */
  respawnSeconds: number;
};

/**
 * Global chest constants
 */
export const CHEST_CONSTANTS = {
  /** Number of chest spawn points per world (target 30-50) */
  SPAWN_POINTS_PER_WORLD: 40,
  
  /** Max chests player can collect per run */
  INVENTORY_CAP_PER_RUN: 20,
  
  /** Radius in meters for counting "nearby trees" for unlock */
  NEARBY_TREES_RADIUS: 22,
  
  /** Interaction radius in meters */
  INTERACTION_RADIUS: 3.5,
} as const;

/**
 * Spawn weights when a chest spawn point refreshes (sum to 100)
 * Based on Cut Trees guide ranges
 */
export const CHEST_SPAWN_WEIGHTS: Record<ChestTier, number> = {
  common: 46,  // Guide: 40-50%
  rare: 33,    // Guide: 30-35%
  epic: 16,    // Guide: 15-20%
  mythic: 5,   // Guide: 5-8%
};

/**
 * v1 Chest definitions
 */
export const CHESTS: Record<ChestTier, ChestDef> = {
  common: {
    id: "common",
    name: "Common Chest",
    modelUri: "models/environment/Dungeon/wooden-loot-chest.gltf",
    dropTable: {
      common: 70,
      rare: 25,
      epic: 4,
      mythic: 1,
      exotic: 0,
    },
    unlockCost: 8,      // Guide: 5-10 trees
    powerGate: 0,
    respawnSeconds: 150, // 2.5 min (guide: 2-3 min)
  },
  
  rare: {
    id: "rare",
    name: "Rare Chest",
    modelUri: "models/environment/Dungeon/silver-loot-chest.gltf",
    dropTable: {
      common: 20,
      rare: 60,
      epic: 18,
      mythic: 2,
      exotic: 0,
    },
    unlockCost: 18,     // Guide: 15-20 trees
    powerGate: 0,
    respawnSeconds: 150, // 2.5 min (guide: 2-3 min)
  },
  
  epic: {
    id: "epic",
    name: "Epic Chest",
    modelUri: "models/environment/House/chest-blocky-wood-double.gltf",
    dropTable: {
      common: 5,
      rare: 30,
      epic: 50,
      mythic: 14,
      exotic: 1,
    },
    unlockCost: 30,     // Guide: 25-35 trees
    powerGate: 2000,    // Guide: 2000+ Cutting Power
    respawnSeconds: 360, // 6 min (guide: 5-7 min)
  },
  
  mythic: {
    id: "mythic",
    name: "Mythic Chest",
    modelUri: "models/environment/Dungeon/legendary-loot-chest.gltf",
    dropTable: {
      common: 1,
      rare: 10,
      epic: 35,
      mythic: 50,
      exotic: 4,
    },
    unlockCost: 45,     // Guide: 40-50 trees
    powerGate: 10000,   // Guide: 10,000+ Cutting Power
    respawnSeconds: 750, // 12.5 min (guide: 10-15 min)
  },
};

/** Roll which chest tier spawns at a spawn point */
export function rollChestTier(rng: () => number = Math.random): ChestTier {
  const weights = CHEST_SPAWN_WEIGHTS;
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  
  let r = rng() * total;
  for (const [tier, weight] of Object.entries(weights) as Array<[ChestTier, number]>) {
    r -= weight;
    if (r <= 0) return tier;
  }
  
  return "common"; // Fallback
}

/** Check if player can unlock a chest */
export function canUnlockChest(
  chest: ChestDef,
  playerPower: number,
  nearbyTreesChopped: number
): { canUnlock: boolean; reason?: string } {
  if (playerPower < chest.powerGate) {
    return {
      canUnlock: false,
      reason: `Requires ${chest.powerGate.toLocaleString()} Cutting Power (you have ${playerPower.toLocaleString()})`,
    };
  }
  
  if (nearbyTreesChopped < chest.unlockCost) {
    return {
      canUnlock: false,
      reason: `Chop ${chest.unlockCost - nearbyTreesChopped} more nearby trees`,
    };
  }
  
  return { canUnlock: true };
}
