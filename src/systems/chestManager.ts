/**
 * Chest management system.
 * Handles chest spawning, unlock tracking, and collection.
 */

import { Entity, EntityEvent, ColliderShape, RigidBodyType } from 'hytopia';
import type { ChestTier, ChestDef } from '../game/chests';
import { CHESTS, CHEST_CONSTANTS, rollChestTier, canUnlockChest } from '../game/chests';
import { openChest, applyChestRewards, formatChestResults } from '../game/loot';
import { loadPlayerData } from './playerManager';
import * as PlayerManager from './playerManager';
import type { WorldLoopTimerManager } from './timers';

type World = any;
type Player = any;
type Vec3 = { x: number; y: number; z: number };

/** Runtime state for a spawned chest */
interface ChestInstance {
  id: string;
  entity: Entity;
  tier: ChestTier;
  definition: ChestDef;
  position: Vec3;
  isOpen: boolean;
}

/** Chest spawn point configuration */
export interface ChestSpawnPoint {
  id: string;
  position: Vec3;
}

export class ChestManager {
  private world: World;
  private timers: WorldLoopTimerManager;
  private chests = new Map<string, ChestInstance>();
  private spawnPoints: ChestSpawnPoint[] = [];
  
  /** Track trees chopped near each spawn point, per player */
  private treeChopsNearSpawnPoint = new Map<string, Map<string, number>>();

  constructor(world: World, timers: WorldLoopTimerManager) {
    this.world = world;
    this.timers = timers;
  }

  /**
   * Add a chest spawn point
   */
  addSpawnPoint(point: ChestSpawnPoint): void {
    this.spawnPoints.push(point);
    this.treeChopsNearSpawnPoint.set(point.id, new Map());
  }

  /**
   * Add multiple spawn points
   */
  addSpawnPoints(points: ChestSpawnPoint[]): void {
    for (const point of points) {
      this.addSpawnPoint(point);
    }
  }

  /**
   * Get all spawn point IDs and positions (for tree manager integration)
   */
  getSpawnPointsForTreeTracking(): Array<{ id: string; position: Vec3 }> {
    return this.spawnPoints.map(p => ({ id: p.id, position: p.position }));
  }

  /**
   * Spawn all chests at their spawn points
   */
  spawnAll(): void {
    for (const point of this.spawnPoints) {
      this.spawnChest(point);
    }
  }

  /**
   * Spawn a chest at a spawn point with random tier
   */
  private spawnChest(point: ChestSpawnPoint): void {
    const tier = rollChestTier();
    const def = CHESTS[tier];

    // Create chest entity
    const entity = new Entity({
      name: `Chest-${point.id}`,
      modelUri: def.modelUri,
      modelScale: 1,
      modelPreferredShape: ColliderShape.BLOCK,
      rigidBodyOptions: {
        type: RigidBodyType.FIXED,
      },
    });

    // Create chest instance
    const instance: ChestInstance = {
      id: point.id,
      entity,
      tier,
      definition: def,
      position: point.position,
      isOpen: false,
    };

    // Store reference
    this.chests.set(point.id, instance);
    (entity as any).__chestId = point.id;

    // Set up interaction handler
    entity.on(EntityEvent.INTERACT, ({ entity: e, player }) => {
      this.handleChestInteraction(point.id, player);
    });

    // Spawn the entity
    entity.spawn(this.world, point.position);
  }

  /**
   * Handle player interacting with a chest
   */
  private handleChestInteraction(chestId: string, player: Player): void {
    const chest = this.chests.get(chestId);
    if (!chest || chest.isOpen) return;

    const playerData = loadPlayerData(player);
    const nearbyTrees = this.getPlayerTreeChops(player, chestId);

    // Check if player can unlock
    const { canUnlock, reason } = canUnlockChest(
      chest.definition,
      playerData.power,
      nearbyTrees
    );

    if (!canUnlock) {
      // Send feedback to player
      this.world.chatManager.sendPlayerMessage(
        player,
        `Cannot open ${chest.definition.name}: ${reason}`,
        'FF6B6B'
      );
      return;
    }

    // Check inventory cap
    const session = PlayerManager.getSession(player);
    if (session && session.collectedChests.length >= CHEST_CONSTANTS.INVENTORY_CAP_PER_RUN) {
      this.world.chatManager.sendPlayerMessage(
        player,
        `Inventory full! (${CHEST_CONSTANTS.INVENTORY_CAP_PER_RUN} chests max per run)`,
        'FF6B6B'
      );
      return;
    }

    // Open the chest
    this.openChest(chest, player);
  }

  /**
   * Open a chest and give rewards to player
   */
  private openChest(chest: ChestInstance, player: Player): void {
    chest.isOpen = true;

    // Get player data
    const playerData = loadPlayerData(player);

    // Roll rewards
    const results = openChest(chest.tier, playerData);

    // Apply rewards
    applyChestRewards(playerData, results);

    // Save updated data
    for (const result of results) {
      if (result.kind === 'axe') {
        PlayerManager.grantAxe(player, result.axeId);
      } else {
        PlayerManager.awardShards(player, result.amount);
      }
    }
    PlayerManager.incrementChestsOpened(player);

    // Track in session
    const session = PlayerManager.getSession(player);
    if (session) {
      session.collectedChests.push({
        tier: chest.tier,
        spawnPointId: chest.id,
      });
    }

    // Send feedback
    const messages = formatChestResults(results);
    for (const msg of messages) {
      this.world.chatManager.sendPlayerMessage(player, msg, '00FF00');
    }

    // Visual: despawn chest
    if (chest.entity.isSpawned) {
      chest.entity.despawn();
    }

    // Clear tree chop tracking for this spawn point
    this.treeChopsNearSpawnPoint.get(chest.id)?.clear();

    // Schedule respawn
    const respawnMs = chest.definition.respawnSeconds * 1000;
    this.timers.setTimeout(respawnMs, () => {
      this.respawnChest(chest.id);
    });
  }

  /**
   * Respawn a chest after its timer
   */
  private respawnChest(chestId: string): void {
    const point = this.spawnPoints.find(p => p.id === chestId);
    if (!point) return;

    // Remove old instance
    this.chests.delete(chestId);

    // Spawn fresh chest (new random tier)
    this.spawnChest(point);
  }

  /**
   * Track a tree chop near chest spawn points
   * Called by the game when a tree is chopped
   */
  trackTreeChop(player: Player, treePosition: Vec3): void {
    const playerId = player.id ?? player.username;
    const radiusSq = CHEST_CONSTANTS.NEARBY_TREES_RADIUS ** 2;

    for (const point of this.spawnPoints) {
      const dx = point.position.x - treePosition.x;
      const dy = point.position.y - treePosition.y;
      const dz = point.position.z - treePosition.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq <= radiusSq) {
        const playerChops = this.treeChopsNearSpawnPoint.get(point.id);
        if (playerChops) {
          const current = playerChops.get(playerId) ?? 0;
          playerChops.set(playerId, current + 1);
        }
      }
    }
  }

  /**
   * Get number of trees a player has chopped near a spawn point
   */
  getPlayerTreeChops(player: Player, spawnPointId: string): number {
    const playerId = player.id ?? player.username;
    return this.treeChopsNearSpawnPoint.get(spawnPointId)?.get(playerId) ?? 0;
  }

  /**
   * Get chest instance by entity
   */
  getChestByEntity(entity: Entity): ChestInstance | undefined {
    const chestId = (entity as any).__chestId;
    return chestId ? this.chests.get(chestId) : undefined;
  }

  /**
   * Get chest instance by ID
   */
  getChest(chestId: string): ChestInstance | undefined {
    return this.chests.get(chestId);
  }

  /**
   * Get all active chests
   */
  getAllChests(): ChestInstance[] {
    return Array.from(this.chests.values()).filter(c => !c.isOpen);
  }

  /**
   * Clean up all chests
   */
  cleanup(): void {
    for (const chest of this.chests.values()) {
      if (chest.entity.isSpawned) {
        chest.entity.despawn();
      }
    }
    this.chests.clear();
    this.treeChopsNearSpawnPoint.clear();
  }
}
