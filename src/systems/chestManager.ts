/**
 * Chest management system.
 * Handles chest spawning, unlock tracking, and collection to inventory.
 * Chests are collected (not opened) in the world, then opened via UI.
 */

import { Entity, EntityEvent, ColliderShape, RigidBodyType, Audio } from 'hytopia';
import type { ChestTier, ChestDef } from '../game/chests';
import { CHESTS, CHEST_CONSTANTS, rollChestTier, canUnlockChest } from '../game/chests';
import { loadPlayerData } from '../game/playerData';
import * as PlayerManager from './playerManager';
import type { WorldLoopTimerManager } from './timers';

type World = any;
type Player = any;
type Vec3 = { x: number; y: number; z: number };

/** Runtime state for a spawned chest */
interface ChestInstance {
  id: string;
  entity: Entity | null;
  tier: ChestTier;
  definition: ChestDef;
  position: Vec3;
  groundY: number;
  isCollected: boolean;
}

/** Chest spawn point configuration (authored with fixed tier) */
export interface ChestSpawnPoint {
  id: string;
  position: Vec3;
  /** Fixed chest tier for this spawn point */
  chestType?: ChestTier;
  /** Radius for counting nearby trees (uses CHEST_CONSTANTS.NEARBY_TREES_RADIUS if not set) */
  nearbyRadius?: number;
  /** Trees required to unlock (uses chest definition if not set) */
  unlockCostTrees?: number;
}

/** Collected chest in player inventory */
export interface CollectedChest {
  tier: ChestTier;
  spawnPointId: string;
  collectedAt: number;
}

/** Callback when chest is collected */
export type ChestCollectedCallback = (player: Player, chest: CollectedChest) => void;

export class ChestManager {
  private world: World;
  private timers: WorldLoopTimerManager;
  private chests = new Map<string, ChestInstance>();
  private spawnPoints: ChestSpawnPoint[] = [];
  
  /** Track trees chopped near each spawn point, per player */
  private treeChopsNearSpawnPoint = new Map<string, Map<string, number>>();
  
  /** Callback for chest collection events */
  private onChestCollected?: ChestCollectedCallback;

  constructor(world: World, timers: WorldLoopTimerManager) {
    this.world = world;
    this.timers = timers;
  }

  /**
   * Set callback for when chests are collected
   */
  setOnChestCollected(callback: ChestCollectedCallback): void {
    this.onChestCollected = callback;
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
   * Get all spawn point positions (for tree manager tracking)
   */
  getSpawnPointsForTreeTracking(): Array<{ id: string; position: Vec3 }> {
    return this.spawnPoints.map(p => ({ id: p.id, position: p.position }));
  }

  /**
   * Get ground height from spawn point Y coordinate.
   * The spawn point Y is pre-calculated from map data in index.ts.
   */
  private getGroundY(spawnPointY: number): number {
    return spawnPointY;
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
   * Spawn chests only at the given spawn points (e.g. when adding a new area).
   */
  spawnSpawnPoints(points: ChestSpawnPoint[]): void {
    for (const point of points) {
      this.spawnChest(point);
    }
  }

  /**
   * Spawn a chest at a spawn point (uses authored tier if set, otherwise random)
   */
  private spawnChest(point: ChestSpawnPoint): void {
    // Use authored tier if provided, otherwise roll randomly
    const tier = point.chestType ?? rollChestTier();
    const def = CHESTS[tier];

    // Use Y from spawn point (pre-calculated from map data)
    const groundY = this.getGroundY(point.position.y);

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
      position: { x: point.position.x, y: groundY, z: point.position.z },
      groundY,
      isCollected: false,
    };

    // Store reference
    this.chests.set(point.id, instance);
    (entity as any).__chestId = point.id;

    // Set up interaction handler
    entity.on(EntityEvent.INTERACT, ({ player }: any) => {
      this.handleChestInteraction(point.id, player);
    });

    // Spawn on the ground
    entity.spawn(this.world, { x: point.position.x, y: groundY, z: point.position.z });
  }

  /**
   * Handle player interacting with a chest
   */
  private handleChestInteraction(chestId: string, player: Player): void {
    const chest = this.chests.get(chestId);
    if (!chest || chest.isCollected) return;

    const playerData = loadPlayerData(player);
    const nearbyTrees = this.getPlayerTreeChops(player, chestId);

    // Get spawn point for authored unlock cost (if any)
    const spawnPoint = this.spawnPoints.find(p => p.id === chestId);
    const unlockCost = spawnPoint?.unlockCostTrees ?? chest.definition.unlockCost;

    // Check if player can unlock (use authored unlock cost if available)
    const effectiveDef = {
      ...chest.definition,
      unlockCost,
    };
    const { canUnlock, reason } = canUnlockChest(
      effectiveDef,
      playerData.power,
      nearbyTrees
    );

    if (!canUnlock) {
      // Send feedback to player
      this.world.chatManager.sendPlayerMessage(
        player,
        `Cannot collect ${chest.definition.name}: ${reason}`,
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

    // Collect the chest (don't open yet)
    this.collectChest(chest, player);
  }

  /**
   * Collect a chest to player's inventory (not opened yet)
   */
  private collectChest(chest: ChestInstance, player: Player): void {
    chest.isCollected = true;

    // Create collected chest record
    const collectedChest: CollectedChest = {
      tier: chest.tier,
      spawnPointId: chest.id,
      collectedAt: Date.now(),
    };

    // Add to player's session inventory
    const session = PlayerManager.getSession(player);
    if (session) {
      session.collectedChests.push(collectedChest);
    }

    // Play collect sound at chest position (Hytopia asset: inventory grab)
    new Audio({
      uri: 'audio/sfx/ui/inventory-grab-item.mp3',
      volume: 0.4,
      referenceDistance: 10,
      position: chest.position,
    }).play(this.world);

    // Send feedback
    this.world.chatManager.sendPlayerMessage(
      player,
      `Collected ${chest.definition.name}! (${session?.collectedChests.length ?? 1}/${CHEST_CONSTANTS.INVENTORY_CAP_PER_RUN})`,
      '00FF00'
    );

    // Notify callback
    if (this.onChestCollected) {
      this.onChestCollected(player, collectedChest);
    }

    // Despawn chest entity
    if (chest.entity?.isSpawned) {
      chest.entity.despawn();
    }
    chest.entity = null;

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
   */
  trackTreeChop(player: Player, treePosition: Vec3): void {
    const playerId = player.id ?? player.username;

    for (const point of this.spawnPoints) {
      const chest = this.chests.get(point.id);
      if (!chest || chest.isCollected) continue;

      // Use authored radius if available, otherwise default
      const radius = point.nearbyRadius ?? CHEST_CONSTANTS.NEARBY_TREES_RADIUS;
      const radiusSq = radius * radius;

      const dx = chest.position.x - treePosition.x;
      const dz = chest.position.z - treePosition.z;
      const distSq = dx * dx + dz * dz;

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
   * Try to collect the nearest chest within interaction radius of the player's position.
   * Used as a backup when the player's raycast doesn't directly hit a chest entity.
   */
  tryCollectNearby(player: Player, playerPosition: Vec3): void {
    const radiusSq = CHEST_CONSTANTS.INTERACTION_RADIUS * CHEST_CONSTANTS.INTERACTION_RADIUS;
    let nearest: ChestInstance | null = null;
    let nearestDistSq = Infinity;

    for (const chest of this.chests.values()) {
      if (chest.isCollected) continue;

      const dx = chest.position.x - playerPosition.x;
      const dz = chest.position.z - playerPosition.z;
      const distSq = dx * dx + dz * dz;

      if (distSq <= radiusSq && distSq < nearestDistSq) {
        nearest = chest;
        nearestDistSq = distSq;
      }
    }

    if (!nearest) return;

    this.handleChestInteraction(nearest.id, player);
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
    return Array.from(this.chests.values()).filter(c => !c.isCollected);
  }

  /**
   * Clean up all chests
   */
  cleanup(): void {
    for (const chest of this.chests.values()) {
      if (chest.entity?.isSpawned) {
        chest.entity.despawn();
      }
    }
    this.chests.clear();
    this.treeChopsNearSpawnPoint.clear();
  }
}
