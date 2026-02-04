/**
 * Chopping system.
 * Handles player swings, raycasts, AoE damage to trees.
 */

import { PlayerEvent, Collider, ColliderShape } from 'hytopia';
import { AXES } from '../game/axes';
import { getEffectiveDamage, getEffectiveArea } from '../game/playerData';
import * as PlayerManager from './playerManager';
import type { TreeManager } from './treeManager';
import type { ChestManager } from './chestManager';

type World = any;
type Player = any;
type Vec3 = { x: number; y: number; z: number };

export class ChoppingSystem {
  private world: World;
  private treeManager: TreeManager;
  private chestManager: ChestManager;

  constructor(world: World, treeManager: TreeManager, chestManager: ChestManager) {
    this.world = world;
    this.treeManager = treeManager;
    this.chestManager = chestManager;
  }

  /**
   * Initialize the chopping system - set up input handlers
   */
  initialize(): void {
    // Listen for player interactions (left click)
    this.world.on(PlayerEvent.JOINED_WORLD, ({ player }: any) => {
      this.setupPlayerInteraction(player);
    });
  }

  /**
   * Set up interaction handler for a player
   */
  private setupPlayerInteraction(player: Player): void {
    player.on(PlayerEvent.INTERACT, ({ raycastHit, interactOrigin, interactDirection }: any) => {
      this.handleSwing(player, raycastHit, interactOrigin, interactDirection);
    });
  }

  /**
   * Handle a player's swing/interaction
   */
  private handleSwing(
    player: Player,
    raycastHit: any,
    origin: Vec3 | undefined,
    direction: Vec3 | undefined
  ): void {
    // Check cooldown
    if (!PlayerManager.canSwing(player)) {
      return;
    }

    // Record the swing and animate axe + player arm
    PlayerManager.recordSwing(player);
    PlayerManager.animateSwing(player, this.world);

    // Get equipped axe
    const playerData = PlayerManager.loadPlayerData(player);
    const axe = AXES[playerData.equippedAxe] ?? AXES.wooden;

    // Calculate effective stats with upgrades
    const damage = getEffectiveDamage(playerData, axe.id, axe.damage);
    const areaRadius = getEffectiveArea(playerData, axe.id, axe.areaRadius);

    // Determine hit point for AoE - use player position for more reliable targeting
    const playerEntity = this.world.entityManager.getPlayerEntitiesByPlayer(player)[0];
    let hitPoint: Vec3;
    
    if (raycastHit?.hitPoint) {
      // Use the actual hit point from raycast
      hitPoint = raycastHit.hitPoint;
    } else if (playerEntity?.position) {
      // No raycast hit - use player position (more reliable for tree targeting)
      const pos = playerEntity.position;
      hitPoint = { x: pos.x, y: pos.y, z: pos.z };
    } else if (origin && direction) {
      // Fallback: project forward from origin
      const maxRange = 3;
      hitPoint = {
        x: origin.x + direction.x * maxRange,
        y: origin.y + direction.y * maxRange,
        z: origin.z + direction.z * maxRange,
      };
    } else {
      // No origin/direction - can't determine hit point
      return;
    }

    // Find all trees in AoE radius
    // Cap wooden axe at 3 to prevent too-long reach on fallback detection
    const baseSearchRadius = areaRadius + 1;
    const searchRadius = axe.id === 'wooden' ? Math.min(baseSearchRadius, 3) : baseSearchRadius;
    const treesInRange = this.treeManager.getTreesInRadius(hitPoint, searchRadius);

    if (treesInRange.length === 0) {
      // No trees hit - maybe send feedback
      return;
    }

    // Apply damage to all trees in range
    let treesChopped = 0;
    for (const tree of treesInRange) {
      const wasChopped = this.treeManager.damageTree(tree.id, damage, player);
      
      if (wasChopped) {
        treesChopped++;
        
        // Track tree chop near chest spawn points
        this.chestManager.trackTreeChop(player, tree.position);

        // Send feedback
        this.world.chatManager.sendPlayerMessage(
          player,
          `+${tree.powerReward} Power`,
          '7CFC00'
        );
      }
    }

    // Send AoE feedback if multiple trees hit
    if (treesInRange.length > 1) {
      this.world.chatManager.sendPlayerMessage(
        player,
        `Hit ${treesInRange.length} trees!`,
        'FFD700'
      );
    }
  }

  /**
   * Manual damage call (for testing or special mechanics)
   */
  damageTreeAt(player: Player, position: Vec3, radius?: number): void {
    const playerData = PlayerManager.loadPlayerData(player);
    const axe = AXES[playerData.equippedAxe] ?? AXES.wooden;
    const damage = getEffectiveDamage(playerData, axe.id, axe.damage);
    const areaRadius = radius ?? getEffectiveArea(playerData, axe.id, axe.areaRadius);

    const trees = this.treeManager.getTreesInRadius(position, areaRadius);
    
    for (const tree of trees) {
      const wasChopped = this.treeManager.damageTree(tree.id, damage, player);
      if (wasChopped) {
        this.chestManager.trackTreeChop(player, tree.position);
      }
    }
  }

  /**
   * Auto-chop: find and damage nearest tree to player
   * Used by UI auto-chop button
   */
  autoChop(player: Player): boolean {
    // Check cooldown
    if (!PlayerManager.canSwing(player)) {
      return false;
    }

    // Get player entity position
    const playerEntity = this.world.entityManager.getPlayerEntitiesByPlayer(player)[0];
    if (!playerEntity) {
      return false;
    }

    const playerPos = playerEntity.position;
    if (!playerPos) {
      return false;
    }

    // Record the swing and animate axe + player arm
    PlayerManager.recordSwing(player);
    PlayerManager.animateSwing(player, this.world);

    // Get equipped axe
    const playerData = PlayerManager.loadPlayerData(player);
    const axe = AXES[playerData.equippedAxe] ?? AXES.wooden;

    // Calculate effective stats with upgrades
    const damage = getEffectiveDamage(playerData, axe.id, axe.damage);
    const areaRadius = getEffectiveArea(playerData, axe.id, axe.areaRadius);

    // Find nearest tree within range
    // Cap wooden axe at 3 to prevent too-long reach
    const baseSearchRadius = areaRadius + 1;
    const searchRadius = axe.id === 'wooden' ? Math.min(baseSearchRadius, 3) : baseSearchRadius;
    const treesInRange = this.treeManager.getTreesInRadius(playerPos, searchRadius);

    if (treesInRange.length === 0) {
      return false;
    }

    // Sort by distance and get the nearest one
    treesInRange.sort((a, b) => {
      const distA = (a.position.x - playerPos.x) ** 2 + (a.position.z - playerPos.z) ** 2;
      const distB = (b.position.x - playerPos.x) ** 2 + (b.position.z - playerPos.z) ** 2;
      return distA - distB;
    });

    // Damage the nearest tree
    const nearestTree = treesInRange[0];
    const wasChopped = this.treeManager.damageTree(nearestTree.id, damage, player);

    if (wasChopped) {
      this.chestManager.trackTreeChop(player, nearestTree.position);
      this.world.chatManager.sendPlayerMessage(
        player,
        `+${nearestTree.powerReward} Power`,
        '7CFC00'
      );
    }

    return true;
  }
}
