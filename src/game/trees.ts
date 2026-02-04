/**
 * Tree and debris definitions.
 * Based on Cut Trees v1 tuning sheet.
 * 
 * Trees are what players chop. When chopped, they spawn debris (stump/fern/driftwood)
 * which remains until the tree respawns.
 */

export type TreeTier = 1 | 2 | 3 | 4;

/** Actual choppable tree types */
export type TreeId =
  | "oak_small"
  | "pine_small"
  | "oak_medium"
  | "pine_medium"
  | "oak_big"
  | "pine_big"
  | "palm";

/** Debris that appears after chopping */
export type DebrisId = "fern" | "weathered_stump" | "driftwood";

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

export type DebrisDef = {
  id: DebrisId;
  name: string;
  modelUri: string;
};

/**
 * Debris models - spawned when a tree is chopped
 */
export const DEBRIS: Record<DebrisId, DebrisDef> = {
  fern: {
    id: "fern",
    name: "Fern",
    modelUri: "models/environment/Tropical/fern.gltf",
  },
  weathered_stump: {
    id: "weathered_stump",
    name: "Tree Stump",
    modelUri: "models/environment/Plains/weathered-tree-stump.gltf",
  },
  driftwood: {
    id: "driftwood",
    name: "Driftwood",
    modelUri: "models/environment/Tropical/driftwood.gltf",
  },
};

/** All debris IDs for random selection */
export const DEBRIS_IDS: DebrisId[] = ["fern", "weathered_stump", "driftwood"];

/** Get random debris to spawn after chopping */
export function getRandomDebris(): DebrisDef {
  const id = DEBRIS_IDS[Math.floor(Math.random() * DEBRIS_IDS.length)];
  return DEBRIS[id];
}

/**
 * Tree definitions (v1 tuning)
 */
export const TREES: Record<TreeId, TreeDef> = {
  // Tier 1 - Small trees
  oak_small: {
    id: "oak_small",
    name: "Small Oak Tree",
    tier: 1,
    modelUri: "models/environment/Plains/oak-tree-small.gltf",
    maxHp: 140,
    powerReward: 9,
    respawnSeconds: 30,
  },
  pine_small: {
    id: "pine_small",
    name: "Small Pine Tree",
    tier: 1,
    modelUri: "models/environment/Pine Forest/pine-tree-small.gltf",
    maxHp: 140,
    powerReward: 9,
    respawnSeconds: 30,
  },

  // Tier 2 - Medium trees
  oak_medium: {
    id: "oak_medium",
    name: "Medium Oak Tree",
    tier: 2,
    modelUri: "models/environment/Plains/oak-tree-medium.gltf",
    maxHp: 280,
    powerReward: 18,
    respawnSeconds: 40,
  },
  pine_medium: {
    id: "pine_medium",
    name: "Medium Pine Tree",
    tier: 2,
    modelUri: "models/environment/Pine Forest/pine-tree-medium.gltf",
    maxHp: 280,
    powerReward: 18,
    respawnSeconds: 40,
  },

  // Tier 3 - Large trees
  oak_big: {
    id: "oak_big",
    name: "Large Oak Tree",
    tier: 3,
    modelUri: "models/environment/Plains/oak-tree-big.gltf",
    maxHp: 560,
    powerReward: 36,
    respawnSeconds: 55,
  },
  pine_big: {
    id: "pine_big",
    name: "Large Pine Tree",
    tier: 3,
    modelUri: "models/environment/Pine Forest/pine-tree-big.gltf",
    maxHp: 560,
    powerReward: 36,
    respawnSeconds: 55,
  },

  // Tier 4 - Special trees
  palm: {
    id: "palm",
    name: "Palm Tree",
    tier: 4,
    modelUri: "models/environment/Tropical/palm-1.gltf",
    maxHp: 560,
    powerReward: 36,
    respawnSeconds: 55,
  },
};

/** All tree IDs for spawning */
export const TREE_IDS: TreeId[] = Object.keys(TREES) as TreeId[];

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
