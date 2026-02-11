/**
 * Player data structure for persistence.
 * Uses HYTOPIA's persisted player data system.
 * 
 * @see https://dev.hytopia.com/sdk-guides/players/persisted-player-data
 */

import { AXES, type AxeId } from "./axes";

const VALID_AXE_IDS = new Set<string>(Object.keys(AXES));

/**
 * Persistent player data stored across sessions
 */
export type PlayerData = {
  /** Total Cutting Power accumulated (progression stat) */
  power: number;
  
  /** Shards currency (from duplicate axes) */
  shards: number;
  
  /** Owned axes - count for tracking duplicates */
  ownedAxes: Partial<Record<AxeId, number>>;
  
  /** Currently equipped axe */
  equippedAxe: AxeId;
  
  /** Axe upgrades: damage bonus per axe (percentage, e.g., 0.05 = +5%) */
  axeDamageBonus: Partial<Record<AxeId, number>>;
  
  /** Axe upgrades: area bonus per axe (absolute, e.g., 0.2 = +0.2m) */
  axeAreaBonus: Partial<Record<AxeId, number>>;
  
  /** Statistics */
  stats: {
    treesChopped: number;
    chestsOpened: number;
    totalShardsClaimed: number;
  };
};

/**
 * Default player data for new players
 */
export const DEFAULT_PLAYER_DATA: PlayerData = {
  power: 0,
  shards: 0,
  ownedAxes: { wooden: 1 },
  equippedAxe: "wooden",
  axeDamageBonus: {},
  axeAreaBonus: {},
  stats: {
    treesChopped: 0,
    chestsOpened: 0,
    totalShardsClaimed: 0,
  },
};

/** Collected chest stored in session inventory */
export type CollectedChest = {
  tier: string;
  spawnPointId: string;
  collectedAt: number;
};

/**
 * Per-run session data (not persisted)
 */
export type PlayerSessionData = {
  /** Chests collected this run (capped at INVENTORY_CAP_PER_RUN) */
  collectedChests: CollectedChest[];
  
  /** Trees chopped near each chest spawn point this run */
  nearbyTreesChoppedBySpawnPoint: Map<string, number>;
  
  /** Last swing timestamp for cooldown tracking */
  lastSwingTime: number;
};

/**
 * Create new session data for a player run
 */
export function createSessionData(): PlayerSessionData {
  return {
    collectedChests: [],
    nearbyTreesChoppedBySpawnPoint: new Map(),
    lastSwingTime: 0,
  };
}

/**
 * Check if player owns an axe
 */
export function ownsAxe(playerData: PlayerData, axeId: AxeId): boolean {
  return (playerData.ownedAxes[axeId] ?? 0) > 0;
}

/**
 * Get effective damage for an axe (base + upgrades)
 */
export function getEffectiveDamage(playerData: PlayerData, axeId: AxeId, baseDamage: number): number {
  const bonus = playerData.axeDamageBonus[axeId] ?? 0;
  return Math.round(baseDamage * (1 + bonus));
}

/**
 * Get effective area for an axe (base + upgrades)
 */
export function getEffectiveArea(playerData: PlayerData, axeId: AxeId, baseArea: number): number {
  const bonus = playerData.axeAreaBonus[axeId] ?? 0;
  return baseArea + bonus;
}

/**
 * Load player data from HYTOPIA persisted data
 * Creates defaults if none exists
 */
export function loadPlayerData(player: any): PlayerData {
  const saved = player.getPersistedData() as PlayerData | undefined;
  
  if (!saved) {
    const defaults = { ...DEFAULT_PLAYER_DATA };
    player.setPersistedData(defaults);
    return defaults;
  }
  
  const data: PlayerData = {
    ...DEFAULT_PLAYER_DATA,
    ...saved,
    ownedAxes: { ...DEFAULT_PLAYER_DATA.ownedAxes, ...saved.ownedAxes },
    axeDamageBonus: { ...saved.axeDamageBonus },
    axeAreaBonus: { ...saved.axeAreaBonus },
    stats: { ...DEFAULT_PLAYER_DATA.stats, ...saved.stats },
  };
  return data;
}

/**
 * Repair desynced or invalid player data (invalid axe ids, missing owned, bad numbers).
 * Mutates data in place and returns the minimal updates to persist.
 * Call after loadPlayerData; if updates is non-empty, call setPersistedData(updates).
 */
export function repairPlayerData(data: PlayerData): Partial<PlayerData> {
  const updates: Partial<PlayerData> = {};
  let repaired = false;

  // Ensure equippedAxe is a valid AxeId and that we own it
  const validEquipped = VALID_AXE_IDS.has(data.equippedAxe) && AXES[data.equippedAxe as AxeId];
  if (!validEquipped) {
    data.equippedAxe = "wooden";
    updates.equippedAxe = "wooden";
    repaired = true;
  }
  if ((data.ownedAxes[data.equippedAxe as AxeId] ?? 0) < 1) {
    data.ownedAxes[data.equippedAxe as AxeId] = 1;
    updates.ownedAxes = { ...data.ownedAxes };
    repaired = true;
  }

  // Sanitize ownedAxes: only valid axe ids, at least wooden
  const sanitized: Partial<Record<AxeId, number>> = {};
  for (const id of Object.keys(data.ownedAxes) as AxeId[]) {
    if (VALID_AXE_IDS.has(id)) {
      const n = data.ownedAxes[id] ?? 0;
      if (typeof n === "number" && n >= 0 && Number.isFinite(n)) sanitized[id] = n;
    }
  }
  if (!sanitized.wooden || sanitized.wooden < 1) sanitized.wooden = 1;
  const ownedKeys = new Set(Object.keys(sanitized));
  const prevKeys = new Set(Object.keys(data.ownedAxes));
  if (ownedKeys.size !== prevKeys.size || [...ownedKeys].some(k => !prevKeys.has(k))) {
    data.ownedAxes = sanitized;
    updates.ownedAxes = sanitized;
    repaired = true;
  }

  // Clamp numeric fields
  if (typeof data.power !== "number" || !Number.isFinite(data.power) || data.power < 0) {
    data.power = 0;
    updates.power = 0;
    repaired = true;
  }
  if (typeof data.shards !== "number" || !Number.isFinite(data.shards) || data.shards < 0) {
    data.shards = 0;
    updates.shards = 0;
    repaired = true;
  }
  const stats = data.stats;
  if (
    typeof stats.treesChopped !== "number" || !Number.isFinite(stats.treesChopped) || stats.treesChopped < 0 ||
    typeof stats.chestsOpened !== "number" || !Number.isFinite(stats.chestsOpened) || stats.chestsOpened < 0 ||
    typeof stats.totalShardsClaimed !== "number" || !Number.isFinite(stats.totalShardsClaimed) || stats.totalShardsClaimed < 0
  ) {
    data.stats = {
      treesChopped: Math.max(0, Number(stats.treesChopped) || 0),
      chestsOpened: Math.max(0, Number(stats.chestsOpened) || 0),
      totalShardsClaimed: Math.max(0, Number(stats.totalShardsClaimed) || 0),
    };
    updates.stats = data.stats;
    repaired = true;
  }

  return repaired ? updates : {};
}
