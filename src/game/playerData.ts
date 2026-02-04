/**
 * Player data structure for persistence.
 * Uses HYTOPIA's persisted player data system.
 * 
 * @see https://dev.hytopia.com/sdk-guides/players/persisted-player-data
 */

import type { AxeId } from "./axes";

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

/**
 * Per-run session data (not persisted)
 */
export type PlayerSessionData = {
  /** Chests collected this run (capped at INVENTORY_CAP_PER_RUN) */
  collectedChests: Array<{
    tier: string;
    spawnPointId: string;
  }>;
  
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
  
  return {
    ...DEFAULT_PLAYER_DATA,
    ...saved,
    ownedAxes: { ...DEFAULT_PLAYER_DATA.ownedAxes, ...saved.ownedAxes },
    axeDamageBonus: { ...saved.axeDamageBonus },
    axeAreaBonus: { ...saved.axeAreaBonus },
    stats: { ...DEFAULT_PLAYER_DATA.stats, ...saved.stats },
  };
}
