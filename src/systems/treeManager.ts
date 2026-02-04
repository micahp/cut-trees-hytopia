/**
 * Tree management system.
 * Handles tree spawning, HP tracking, damage, and respawning.
 */

import { Entity, EntityEvent, ColliderShape, RigidBodyType } from 'hytopia';
import type { TreeId, TreeDef } from '../game/trees';
import { TREES, applyWorldMultipliers } from '../game/trees';
import { CHEST_CONSTANTS } from '../game/chests';
import type { WorldLoopTimerManager } from './timers';
import * as PlayerManager from './playerManager';

type World = any;
type Player = any;
type Vec3 = { x: number; y: number; z: number };

/** Runtime state for a spawned tree */
interface TreeInstance {
  id: string;
  entity: Entity;
  definition: TreeDef;
  currentHp: number;
  maxHp: number;
  powerReward: number;
  position: Vec3;
  isChopped: boolean;
}

/** Tree spawn point configuration */
export interface TreeSpawnPoint {
  id: string;
  position: Vec3;
  treeId: TreeId;
}

/** Callback when a tree is chopped down */
export type TreeChoppedCallback = (
  tree: TreeInstance,
  player: Player,
  nearbyChestSpawnPoints: string[]
) => void;

export class TreeManager {
  private world: World;
  private timers: WorldLoopTimerManager;
  private trees = new Map<string, TreeInstance>();
  private spawnPoints: TreeSpawnPoint[] = [];
  private worldType: string = 'forest';
  private onTreeChopped?: TreeChoppedCallback;

  /** Exposed for chest manager to find nearby trees */
  private chestSpawnPoints: Vec3[] = [];

  constructor(world: World, timers: WorldLoopTimerManager) {
    this.world = world;
    this.timers = timers;
  }

  /**
   * Set callback for when trees are chopped
   */
  setOnTreeChopped(callback: TreeChoppedCallback): void {
    this.onTreeChopped = callback;
  }

  /**
   * Register chest spawn points for nearby-tree tracking
   */
  registerChestSpawnPoints(points: Array<{ id: string; position: Vec3 }>): void {
    this.chestSpawnPoints = points.map(p => p.position);
  }

  /**
   * Set the world type for HP/reward multipliers
   */
  setWorldType(type: string): void {
    this.worldType = type;
  }

  /**
   * Add a tree spawn point
   */
  addSpawnPoint(point: TreeSpawnPoint): void {
    this.spawnPoints.push(point);
  }

  /**
   * Add multiple spawn points
   */
  addSpawnPoints(points: TreeSpawnPoint[]): void {
    this.spawnPoints.push(...points);
  }

  /**
   * Spawn all trees at their spawn points
   */
  spawnAll(): void {
    for (const point of this.spawnPoints) {
      this.spawnTree(point);
    }
  }

  /**
   * Spawn a tree at a spawn point
   */
  private spawnTree(point: TreeSpawnPoint): void {
    const def = TREES[point.treeId];
    if (!def) {
      console.error(`[TreeManager] Unknown tree: ${point.treeId}`);
      return;
    }

    // Apply world multipliers
    const { maxHp, powerReward } = applyWorldMultipliers(def, this.worldType);

    // Create tree entity
    const entity = new Entity({
      name: `Tree-${point.id}`,
      modelUri: def.modelUri,
      modelScale: 1,
      modelPreferredShape: ColliderShape.CYLINDER,
      rigidBodyOptions: {
        type: RigidBodyType.FIXED, // Trees don't move
      },
    });

    // Create tree instance
    const instance: TreeInstance = {
      id: point.id,
      entity,
      definition: def,
      currentHp: maxHp,
      maxHp,
      powerReward,
      position: point.position,
      isChopped: false,
    };

    // Store reference before spawning
    this.trees.set(point.id, instance);

    // Store tree ID in entity for lookup
    (entity as any).__treeId = point.id;

    // Spawn the entity
    entity.spawn(this.world, point.position);
  }

  /**
   * Apply damage to a tree from a player
   */
  damageTree(treeId: string, damage: number, player: Player): boolean {
    const tree = this.trees.get(treeId);
    if (!tree || tree.isChopped) return false;

    tree.currentHp -= damage;

    // Visual feedback - brief color tint
    tree.entity.setTintColor({ r: 1, g: 0.8, b: 0.8 });
    setTimeout(() => {
      if (tree.entity.isSpawned) {
        tree.entity.setTintColor(undefined);
      }
    }, 100);

    // Check if chopped down
    if (tree.currentHp <= 0) {
      this.chopTree(tree, player);
      return true;
    }

    return false;
  }

  /**
   * Handle tree being chopped down
   */
  private chopTree(tree: TreeInstance, player: Player): void {
    tree.isChopped = true;

    // Award power to player
    PlayerManager.awardPower(player, tree.powerReward);
    PlayerManager.incrementTreesChopped(player);

    // Find nearby chest spawn points for unlock tracking
    const nearbyChestIds = this.findNearbyChestSpawnPoints(tree.position);

    // Notify callback
    if (this.onTreeChopped) {
      this.onTreeChopped(tree, player, nearbyChestIds);
    }

    // Visual: despawn the tree
    if (tree.entity.isSpawned) {
      tree.entity.despawn();
    }

    // Schedule respawn
    const respawnMs = tree.definition.respawnSeconds * 1000;
    this.timers.setTimeout(respawnMs, () => {
      this.respawnTree(tree.id);
    });
  }

  /**
   * Find chest spawn points within NEARBY_TREES_RADIUS of a position
   */
  private findNearbyChestSpawnPoints(position: Vec3): string[] {
    const radius = CHEST_CONSTANTS.NEARBY_TREES_RADIUS;
    const radiusSq = radius * radius;
    const nearbyIds: string[] = [];

    // This is a simplified version - in production you'd want a spatial index
    // For now we iterate all chest spawn points
    // The actual IDs would be passed from chest manager
    
    return nearbyIds; // Will be populated by integration with ChestManager
  }

  /**
   * Respawn a tree after its timer
   */
  private respawnTree(treeId: string): void {
    const point = this.spawnPoints.find(p => p.id === treeId);
    if (!point) return;

    // Remove old instance
    this.trees.delete(treeId);

    // Spawn fresh tree
    this.spawnTree(point);
  }

  /**
   * Get tree instance by entity
   */
  getTreeByEntity(entity: Entity): TreeInstance | undefined {
    const treeId = (entity as any).__treeId;
    return treeId ? this.trees.get(treeId) : undefined;
  }

  /**
   * Get tree instance by ID
   */
  getTree(treeId: string): TreeInstance | undefined {
    return this.trees.get(treeId);
  }

  /**
   * Get all active trees
   */
  getAllTrees(): TreeInstance[] {
    return Array.from(this.trees.values()).filter(t => !t.isChopped);
  }

  /**
   * Get trees within a radius of a point
   */
  getTreesInRadius(center: Vec3, radius: number): TreeInstance[] {
    const radiusSq = radius * radius;
    const result: TreeInstance[] = [];

    for (const tree of this.trees.values()) {
      if (tree.isChopped) continue;

      const dx = tree.position.x - center.x;
      const dy = tree.position.y - center.y;
      const dz = tree.position.z - center.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq <= radiusSq) {
        result.push(tree);
      }
    }

    return result;
  }

  /**
   * Clean up all trees
   */
  cleanup(): void {
    for (const tree of this.trees.values()) {
      if (tree.entity.isSpawned) {
        tree.entity.despawn();
      }
    }
    this.trees.clear();
  }
}
