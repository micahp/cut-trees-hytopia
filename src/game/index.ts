/**
 * Game configuration barrel export.
 * Import everything from here: import { AXES, CHESTS, TREES, ... } from './game';
 */

// Rarity system
export {
  type Rarity,
  RARITY_ORDER,
  RARITY_COLORS,
  RARITY_DISPLAY_NAMES,
  nextRarityUp,
  rarityIndex,
  isRarityAtLeast,
} from "./rarity";

// Axes
export {
  type AxeId,
  type AxeDef,
  type AxePerks,
  AXES,
  getAxesByRarity,
  getAxeDPS,
} from "./axes";

// Trees
export {
  type TreeId,
  type TreeDef,
  type TreeTier,
  type WorldMultipliers,
  TREES,
  WORLD_MULTIPLIERS,
  getTreesByTier,
  applyWorldMultipliers,
} from "./trees";

// Chests
export {
  type ChestTier,
  type ChestDef,
  CHESTS,
  CHEST_CONSTANTS,
  CHEST_SPAWN_WEIGHTS,
  rollChestTier,
  canUnlockChest,
} from "./chests";

// Player data
export {
  type PlayerData,
  type PlayerSessionData,
  DEFAULT_PLAYER_DATA,
  createSessionData,
  ownsAxe,
  getEffectiveDamage,
  getEffectiveArea,
} from "./playerData";

// Loot system
export {
  type ChestOpenResult,
  SHARDS_FOR_DUPLICATE,
  SHARD_COSTS,
  openChest,
  applyChestRewards,
  upgradeDamage,
  upgradeArea,
  formatChestResults,
} from "./loot";
