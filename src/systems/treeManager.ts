/**
 * Tree management system.
 * Handles tree spawning, HP tracking, damage, debris, and respawning.
 */

import { Entity, ColliderShape, RigidBodyType } from 'hytopia';
import type { TreeId, TreeDef, DebrisDef } from '../game/trees';
import { TREES, applyWorldMultipliers, getRandomDebris } from '../game/trees';
import { CHEST_CONSTANTS } from '../game/chests';
import type { WorldLoopTimerManager } from './timers';
import * as PlayerManager from './playerManager';

type World = any;
type Player = any;
type Vec3 = { x: number; y: number; z: number };

/** Runtime state for a spawned tree */
interface TreeInstance {
  id: string;
  entity: Entity | null;
  debrisEntity: Entity | null;
  definition: TreeDef;
  currentHp: number;
  maxHp: number;
  powerReward: number;
  position: Vec3;
  groundY: number;
  isChopped: boolean;
}

/** Tree spawn point configuration */
export interface TreeSpawnPoint {
  id: string;
  position: Vec3; // x, z used; y will be found via raycast
  treeId: TreeId;
}

/** Callback when a tree is chopped down */
export type TreeChoppedCallback = (
  tree: TreeInstance,
  player: Player
) => void;

export class TreeManager {
  private world: World;
  private timers: WorldLoopTimerManager;
  private trees = new Map<string, TreeInstance>();
  private spawnPoints: TreeSpawnPoint[] = [];
  private worldType: string = 'forest';
  private onTreeChopped?: TreeChoppedCallback;

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
   * Find ground height at a position using raycast
   */
  private findGroundY(x: number, z: number): number {
    const startY = 256;
    const maxDistance = 512;
    const origin = { x, y: startY, z };
    const direction = { x: 0, y: -1, z: 0 };

    const hit = this.world.simulation.raycast(origin, direction, maxDistance);

    if (!hit) {
      console.warn(`[TreeManager] No ground found at ${x}, ${z}`);
      return 1; // Fallback
    }

    // Use block top surface if hit a block
    if (hit.hitBlock) {
      return hit.hitBlock.globalCoordinate.y + 1;
    }

    return hit.hitPoint.y;
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

    // Find ground height
    const groundY = this.findGroundY(point.position.x, point.position.z);

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
      debrisEntity: null,
      definition: def,
      currentHp: maxHp,
      maxHp,
      powerReward,
      position: { x: point.position.x, y: groundY, z: point.position.z },
      groundY,
      isChopped: false,
    };

    // Store reference before spawning
    this.trees.set(point.id, instance);

    // Store tree ID in entity for lookup
    (entity as any).__treeId = point.id;

    // Spawn the entity on the ground
    entity.spawn(this.world, { x: point.position.x, y: groundY, z: point.position.z });
  }

  /**
   * Apply damage to a tree from a player
   */
  damageTree(treeId: string, damage: number, player: Player): boolean {
    const tree = this.trees.get(treeId);
    if (!tree || tree.isChopped || !tree.entity) return false;

    tree.currentHp -= damage;

    // Visual feedback - brief color tint
    tree.entity.setTintColor({ r: 1, g: 0.8, b: 0.8 });
    setTimeout(() => {
      if (tree.entity?.isSpawned) {
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

    // Despawn the tree
    if (tree.entity?.isSpawned) {
      tree.entity.despawn();
    }
    tree.entity = null;

    // Spawn debris at the tree's position
    this.spawnDebris(tree);

    // Notify callback
    if (this.onTreeChopped) {
      this.onTreeChopped(tree, player);
    }

    // Schedule respawn
    const respawnMs = tree.definition.respawnSeconds * 1000;
    this.timers.setTimeout(respawnMs, () => {
      this.respawnTree(tree.id);
    });
  }

  /**
   * Spawn random debris at a chopped tree's position
   */
  private spawnDebris(tree: TreeInstance): void {
    const debris = getRandomDebris();

    const debrisEntity = new Entity({
      name: `Debris-${tree.id}`,
      modelUri: debris.modelUri,
      modelScale: 1,
      modelPreferredShape: ColliderShape.CYLINDER,
      rigidBodyOptions: {
        type: RigidBodyType.FIXED,
      },
    });

    tree.debrisEntity = debrisEntity;

    // Spawn at the same position as the tree was
    debrisEntity.spawn(this.world, tree.position);
  }

  /**
   * Respawn a tree after its timer
   */
  private respawnTree(treeId: string): void {
    const tree = this.trees.get(treeId);
    if (!tree) return;

    // Remove debris
    if (tree.debrisEntity?.isSpawned) {
      tree.debrisEntity.despawn();
    }
    tree.debrisEntity = null;

    // Find the spawn point
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
   * Get all active trees (not chopped)
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
      const dz = tree.position.z - center.z;
      // Use 2D distance (ignore Y) for AoE
      const distSq = dx * dx + dz * dz;

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
      if (tree.entity?.isSpawned) {
        tree.entity.despawn();
      }
      if (tree.debrisEntity?.isSpawned) {
        tree.debrisEntity.despawn();
      }
    }
    this.trees.clear();
  }
}
