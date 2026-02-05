/**
 * Tree management system.
 * Handles tree spawning, HP tracking, damage, debris, and respawning.
 */

import { Entity, ColliderShape, RigidBodyType, Audio } from 'hytopia';
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
   * Get ground height from spawn point Y coordinate.
   * The spawn point Y is pre-calculated from map data in index.ts.
   */
  private getGroundY(spawnPointY: number): number {
    return spawnPointY;
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

    // Use Y from spawn point (pre-calculated from map data)
    const groundY = this.getGroundY(point.position.y);

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

    // Play hit sound at tree position (quieter)
    new Audio({
      uri: 'audio/sfx/damage/hit-wood.mp3',
      volume: 0.25,
      referenceDistance: 6,
      position: tree.position,
    }).play(this.world);

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

    // Play tree fall sound at tree position (quieter)
    new Audio({
      uri: 'audio/sfx/damage/hit-woodbreak.mp3',
      volume: 0.35,
      referenceDistance: 8,
      position: tree.position,
    }).play(this.world);

    // Notify callback immediately (for chest tracking etc)
    if (this.onTreeChopped) {
      this.onTreeChopped(tree, player);
    }

    // Animate tree falling and fading
    this.animateTreeFall(tree);

    // Schedule respawn (after fall animation completes)
    const respawnMs = tree.definition.respawnSeconds * 1000;
    this.timers.setTimeout(respawnMs, () => {
      this.respawnTree(tree.id);
    });
  }

  /**
   * Animate tree falling down then disappear immediately
   * Fall duration: ~600ms
   */
  private animateTreeFall(tree: TreeInstance): void {
    const entity = tree.entity;
    if (!entity || !entity.isSpawned) {
      // No entity to animate, just spawn debris
      this.spawnDebris(tree);
      return;
    }

    // Random fall direction (radians)
    const fallAngle = Math.random() * Math.PI * 2;
    const fallX = Math.sin(fallAngle);
    const fallZ = Math.cos(fallAngle);

    // Animation parameters
    const fallDurationMs = 600;   // Time to fall over
    const frameInterval = 50;     // Update every 50ms

    let elapsed = 0;

    const animationLoop = () => {
      elapsed += frameInterval;

      if (!entity.isSpawned) {
        // Entity was despawned externally
        this.spawnDebris(tree);
        return;
      }

      // Falling animation (rotate toward ground)
      const fallProgress = Math.min(1, elapsed / fallDurationMs);
      // Ease out for natural fall feel
      const easedProgress = 1 - Math.pow(1 - fallProgress, 2);
      // Rotate ~85 degrees (1.5 radians)
      const tiltAngle = easedProgress * 1.5;

      // Convert tilt to quaternion (rotation around horizontal axis perpendicular to fall direction)
      const halfAngle = tiltAngle / 2;
      const sinHalf = Math.sin(halfAngle);
      const cosHalf = Math.cos(halfAngle);
      
      entity.setRotation({
        x: fallZ * sinHalf,  // Rotate around axis perpendicular to fall
        y: 0,
        z: -fallX * sinHalf,
        w: cosHalf,
      });

      if (elapsed >= fallDurationMs) {
        // Fall complete - despawn immediately and spawn debris
        if (entity.isSpawned) {
          entity.despawn();
        }
        tree.entity = null;
        this.spawnDebris(tree);
      } else {
        // Continue animation
        setTimeout(animationLoop, frameInterval);
      }
    };

    // Start animation
    setTimeout(animationLoop, frameInterval);
  }

  /**
   * Spawn random debris at a chopped tree's position
   * Debris has no collision so players can walk through chopped areas
   * Debris fades out over 1 second and disappears
   */
  private spawnDebris(tree: TreeInstance): void {
    const debris = getRandomDebris();

    const debrisEntity = new Entity({
      name: `Debris-${tree.id}`,
      modelUri: debris.modelUri,
      modelScale: 1,
      // No collision - players can walk through debris/stumps
    });

    tree.debrisEntity = debrisEntity;

    // Spawn at the same position as the tree was
    debrisEntity.spawn(this.world, tree.position);

    // Animate fade out over 1 second
    this.animateDebrisFade(debrisEntity);
  }

  /**
   * Animate debris fading out over 1 second then despawn
   */
  private animateDebrisFade(entity: Entity): void {
    const fadeDurationMs = 1000;
    const frameInterval = 50;
    let elapsed = 0;

    const fadeLoop = () => {
      elapsed += frameInterval;

      if (!entity.isSpawned) {
        return; // Entity was despawned externally
      }

      // Calculate opacity (1.0 -> 0.0 over 1 second)
      const progress = Math.min(1, elapsed / fadeDurationMs);
      const opacity = 1 - progress;

      entity.setOpacity(opacity);

      if (elapsed >= fadeDurationMs) {
        // Fade complete - despawn debris
        if (entity.isSpawned) {
          entity.despawn();
        }
      } else {
        // Continue fade animation
        setTimeout(fadeLoop, frameInterval);
      }
    };

    // Start fade animation
    setTimeout(fadeLoop, frameInterval);
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
