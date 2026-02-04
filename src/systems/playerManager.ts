/**
 * Player data management system.
 * Handles persistence, session tracking, and equipped axe attachment.
 */

import { Entity, ColliderShape } from 'hytopia';
import type { PlayerData, PlayerSessionData } from '../game/playerData';
import { DEFAULT_PLAYER_DATA, createSessionData, ownsAxe } from '../game/playerData';
import type { AxeId } from '../game/axes';
import { AXES } from '../game/axes';

type Player = any;
type World = any;

/** Session data stored per-player (not persisted) */
const playerSessions = new Map<string, PlayerSessionData>();

/** Currently equipped axe entity per player */
const equippedAxeEntities = new Map<string, Entity>();

/** Track if player is currently swinging (to prevent overlapping animations) */
const isSwinging = new Map<string, boolean>();

/** Base axe rotation (resting position - axe held at side) */
const BASE_ROTATION = {
  x: 0.35,   // slight pitch
  y: 0.35,   // pointing slightly outward
  z: -0.6,   // blade angled
  w: 0.6,
};

/** Swing back rotation (wind up - axe pulled back across body) */
const SWING_BACK_ROTATION = {
  x: 0.2,    // less pitch
  y: 0.7,    // rotated back across body
  z: -0.4,
  w: 0.55,
};

/** Swing forward rotation (chop - axe swung across body) */
const SWING_FORWARD_ROTATION = {
  x: 0.4,    // more pitch down
  y: -0.2,   // swung across to opposite side
  z: -0.6,
  w: 0.65,
};

/**
 * Get player's unique ID for session tracking
 */
function getPlayerId(player: Player): string {
  return player.id ?? player.username;
}

/**
 * Load player's persisted data, creating defaults if none exists
 */
export function loadPlayerData(player: Player): PlayerData {
  const saved = player.getPersistedData() as PlayerData | undefined;
  
  if (!saved) {
    // First time player - initialize with defaults
    const defaults = { ...DEFAULT_PLAYER_DATA };
    player.setPersistedData(defaults);
    return defaults;
  }
  
  // Merge with defaults to handle schema migrations
  return {
    ...DEFAULT_PLAYER_DATA,
    ...saved,
    ownedAxes: { ...DEFAULT_PLAYER_DATA.ownedAxes, ...saved.ownedAxes },
    axeDamageBonus: { ...saved.axeDamageBonus },
    axeAreaBonus: { ...saved.axeAreaBonus },
    stats: { ...DEFAULT_PLAYER_DATA.stats, ...saved.stats },
  };
}

/**
 * Save player's persisted data (shallow merge)
 */
export function savePlayerData(player: Player, updates: Partial<PlayerData>): void {
  player.setPersistedData(updates);
}

/**
 * Initialize session data for a player joining a run
 */
export function initSession(player: Player): PlayerSessionData {
  const playerId = getPlayerId(player);
  const session = createSessionData();
  playerSessions.set(playerId, session);
  return session;
}

/**
 * Get player's current session data
 */
export function getSession(player: Player): PlayerSessionData | undefined {
  return playerSessions.get(getPlayerId(player));
}

/**
 * Clear session data when player leaves
 */
export function clearSession(player: Player): void {
  const playerId = getPlayerId(player);
  playerSessions.delete(playerId);
  
  // Clean up equipped axe entity
  const axeEntity = equippedAxeEntities.get(playerId);
  if (axeEntity?.isSpawned) {
    axeEntity.despawn();
  }
  equippedAxeEntities.delete(playerId);
}

/**
 * Attach axe model to player's hand, held outward
 */
export function equipAxe(
  player: Player,
  playerEntity: Entity,
  world: World,
  axeId: AxeId
): void {
  const playerId = getPlayerId(player);
  const axeDef = AXES[axeId];
  
  if (!axeDef) {
    console.error(`[PlayerManager] Unknown axe: ${axeId}`);
    return;
  }
  
  // Remove existing equipped axe
  const existingAxe = equippedAxeEntities.get(playerId);
  if (existingAxe?.isSpawned) {
    existingAxe.despawn();
  }
  
  // Create new axe entity as child of player
  const axeEntity = new Entity({
    name: `Axe-${playerId}`,
    modelUri: axeDef.modelUri,
    modelScale: 1,
    modelPreferredShape: ColliderShape.NONE, // Child entities don't need collision
  });
  
  // Spawn first, then attach with rotation
  axeEntity.spawn(world, { x: 0, y: 0, z: 0 });
  
  // Position offset: slightly forward and down from hand
  const position = { x: 0.1, y: -0.1, z: -0.2 };
  
  axeEntity.setParent(playerEntity, 'hand-right-anchor', position, BASE_ROTATION);
  
  equippedAxeEntities.set(playerId, axeEntity);
  
  // Update persisted data
  const data = loadPlayerData(player);
  if (data.equippedAxe !== axeId) {
    savePlayerData(player, { equippedAxe: axeId });
  }
}

/**
 * Get player's equipped axe definition
 */
export function getEquippedAxe(player: Player): typeof AXES[AxeId] {
  const data = loadPlayerData(player);
  return AXES[data.equippedAxe] ?? AXES.wooden;
}

/**
 * Award power to player after chopping a tree
 */
export function awardPower(player: Player, amount: number): number {
  const data = loadPlayerData(player);
  const newPower = data.power + amount;
  savePlayerData(player, { power: newPower });
  return newPower;
}

/**
 * Award shards to player (from duplicate axes)
 */
export function awardShards(player: Player, amount: number): number {
  const data = loadPlayerData(player);
  const newShards = data.shards + amount;
  const newTotal = data.stats.totalShardsClaimed + amount;
  
  savePlayerData(player, {
    shards: newShards,
    stats: { ...data.stats, totalShardsClaimed: newTotal },
  });
  
  return newShards;
}

/**
 * Grant axe to player
 */
export function grantAxe(player: Player, axeId: AxeId): boolean {
  const data = loadPlayerData(player);
  
  if (ownsAxe(data, axeId)) {
    return false; // Already owned
  }
  
  savePlayerData(player, {
    ownedAxes: { ...data.ownedAxes, [axeId]: 1 },
  });
  
  return true;
}

/**
 * Increment trees chopped stat
 */
export function incrementTreesChopped(player: Player): void {
  const data = loadPlayerData(player);
  savePlayerData(player, {
    stats: { ...data.stats, treesChopped: data.stats.treesChopped + 1 },
  });
}

/**
 * Increment chests opened stat
 */
export function incrementChestsOpened(player: Player): void {
  const data = loadPlayerData(player);
  savePlayerData(player, {
    stats: { ...data.stats, chestsOpened: data.stats.chestsOpened + 1 },
  });
}

/**
 * Track tree chopped near a chest spawn point (for unlock progress)
 */
export function trackNearbyTreeChopped(player: Player, spawnPointId: string): number {
  const session = getSession(player);
  if (!session) return 0;
  
  const current = session.nearbyTreesChoppedBySpawnPoint.get(spawnPointId) ?? 0;
  const newCount = current + 1;
  session.nearbyTreesChoppedBySpawnPoint.set(spawnPointId, newCount);
  
  return newCount;
}

/**
 * Get trees chopped near a spawn point (for unlock checking)
 */
export function getNearbyTreesChopped(player: Player, spawnPointId: string): number {
  const session = getSession(player);
  return session?.nearbyTreesChoppedBySpawnPoint.get(spawnPointId) ?? 0;
}

/**
 * Check if player can swing (cooldown check)
 */
export function canSwing(player: Player): boolean {
  const session = getSession(player);
  if (!session) return false;
  
  const axe = getEquippedAxe(player);
  const cooldownMs = axe.cooldown * 1000;
  const now = Date.now();
  
  return (now - session.lastSwingTime) >= cooldownMs;
}

/**
 * Record swing time for cooldown tracking
 */
export function recordSwing(player: Player): void {
  const session = getSession(player);
  if (session) {
    session.lastSwingTime = Date.now();
  }
}

/**
 * Animate axe swing (horizontal swing across body)
 * Total duration ~300ms for snappy feel
 */
export function animateSwing(player: Player, world?: World): void {
  const playerId = getPlayerId(player);
  const axeEntity = equippedAxeEntities.get(playerId);
  
  if (!axeEntity || !axeEntity.isSpawned) return;
  
  // Prevent overlapping animations
  if (isSwinging.get(playerId)) return;
  isSwinging.set(playerId, true);
  
  const position = { x: 0.1, y: -0.1, z: -0.2 };
  
  // Try to trigger player arm animation if world is available
  if (world) {
    const playerEntity = world.entityManager.getPlayerEntitiesByPlayer(player)[0];
    if (playerEntity?.startModelLoopedAnimations) {
      // Trigger a simple swing animation on the player model
      playerEntity.startModelLoopedAnimations(['simple_interact']);
      // Stop after animation completes
      setTimeout(() => {
        if (playerEntity?.isSpawned && playerEntity.stopModelAnimations) {
          playerEntity.stopModelAnimations(['simple_interact']);
        }
      }, 300);
    }
  }
  
  // Phase 1: Swing back (wind up) - 80ms
  axeEntity.setParent(axeEntity.parent!, 'hand-right-anchor', position, SWING_BACK_ROTATION);
  
  // Phase 2: Swing forward (chop) - 120ms
  setTimeout(() => {
    if (axeEntity.isSpawned) {
      axeEntity.setParent(axeEntity.parent!, 'hand-right-anchor', position, SWING_FORWARD_ROTATION);
    }
  }, 80);
  
  // Phase 3: Return to rest - 100ms
  setTimeout(() => {
    if (axeEntity.isSpawned) {
      axeEntity.setParent(axeEntity.parent!, 'hand-right-anchor', position, BASE_ROTATION);
    }
    isSwinging.set(playerId, false);
  }, 250);
}
