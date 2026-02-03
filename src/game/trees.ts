/**
 * Tree definitions with HP, rewards, and respawn timers.
 * Based on Cut Trees v1 tuning sheet.
 * 
 * Tiers are based on tree size - larger trees give more power but take longer to chop.
 */

export type TreeTier = 0 | 1 | 2 | 3 | 4;

export type TreeId =
  | "fern"
  | "weathered_stump"
  | "driftwood"
  | "oak_small"
  | "pine_small"
  | "oak_medium"
  | "pine_medium"
  | "oak_big"
  | "pine_big"
  | "palm";

export type TreeDef = {
  id: TreeId;
  name: string;
  tier: TreeTier;
  
  /** Model path in assets folder */
  modelUri: string;
  
  /** Hit points - damage required to chop down */
  maxHp: number;
  
  /** Cutting Power gained when chopped down */
  powerReward: number;
  
  /** Seconds until tree respawns after being chopped */
  respawnSeconds: number;
};

/**
 * v1 Tree tier table (Forest world baseline)
 */
export const TREES: Record<TreeId, TreeDef> = {
  // Tier 0 - Tiny filler
  fern: {
    id: "fern",
    name: "Fern",
    tier: 0,
    modelUri: "models/environment/fern.gltf",
    maxHp: 35,
    powerReward: 2,
    respawnSeconds: 20,
  },

  // Tier 1 - Small debris
  weathered_stump: {
    id: "weathered_stump",
    name: "Weathered Tree Stump",
    tier: 1,
    modelUri: "models/environment/weathered-tree-stump.gltf",
    maxHp: 70,
    powerReward: 4,
    respawnSeconds: 25,
  },
  driftwood: {
    id: "driftwood",
    name: "Driftwood",
    tier: 1,
    modelUri: "models/environment/driftwood.gltf",
    maxHp: 70,
    powerReward: 4,
    respawnSeconds: 25,
  },

  // Tier 2 - Small trees
  oak_small: {
    id: "oak_small",
    name: "Small Oak Tree",
    tier: 2,
    modelUri: "models/environment/oak-tree-small.gltf",
    maxHp: 140,
    powerReward: 9,
    respawnSeconds: 30,
  },
  pine_small: {
    id: "pine_small",
    name: "Small Pine Tree",
    tier: 2,
    modelUri: "models/environment/pine-tree-small.gltf",
    maxHp: 140,
    powerReward: 9,
    respawnSeconds: 30,
  },

  // Tier 3 - Medium trees
  oak_medium: {
    id: "oak_medium",
    name: "Medium Oak Tree",
    tier: 3,
    modelUri: "models/environment/oak-tree-medium.gltf",
    maxHp: 280,
    powerReward: 18,
    respawnSeconds: 40,
  },
  pine_medium: {
    id: "pine_medium",
    name: "Medium Pine Tree",
    tier: 3,
    modelUri: "models/environment/pine-tree-medium.gltf",
    maxHp: 280,
    powerReward: 18,
    respawnSeconds: 40,
  },

  // Tier 4 - Large trees
  oak_big: {
    id: "oak_big",
    name: "Large Oak Tree",
    tier: 4,
    modelUri: "models/environment/oak-tree-big.gltf",
    maxHp: 560,
    powerReward: 36,
    respawnSeconds: 55,
  },
  pine_big: {
    id: "pine_big",
    name: "Large Pine Tree",
    tier: 4,
    modelUri: "models/environment/pine-tree-big.gltf",
    maxHp: 560,
    powerReward: 36,
    respawnSeconds: 55,
  },
  palm: {
    id: "palm",
    name: "Palm Tree",
    tier: 4,
    modelUri: "models/environment/palm-1.gltf",
    maxHp: 560,
    powerReward: 36,
    respawnSeconds: 55,
  },
};

/** Get all trees of a specific tier */
export function getTreesByTier(tier: TreeTier): TreeDef[] {
  return Object.values(TREES).filter(tree => tree.tier === tier);
}

/**
 * World multipliers for different biomes.
 * Lava world: HP x10, Power gain x3 (harder but rewarding)
 */
export type WorldMultipliers = {
  hpMultiplier: number;
  powerMultiplier: number;
};

export const WORLD_MULTIPLIERS: Record<string, WorldMultipliers> = {
  forest: { hpMultiplier: 1, powerMultiplier: 1 },
  lava: { hpMultiplier: 10, powerMultiplier: 3 },
};

/** Apply world multipliers to a tree definition */
export function applyWorldMultipliers(tree: TreeDef, world: string): { maxHp: number; powerReward: number } {
  const multipliers = WORLD_MULTIPLIERS[world] ?? WORLD_MULTIPLIERS.forest;
  return {
    maxHp: Math.round(tree.maxHp * multipliers.hpMultiplier),
    powerReward: Math.round(tree.powerReward * multipliers.powerMultiplier),
  };
}
