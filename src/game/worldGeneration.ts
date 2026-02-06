/**
 * World generation for Cut Trees.
 * Creates authored tree and chest spawn points with proper placement patterns:
 * - Outer ring tree line (continuous belt along map edge)
 * - Interior groves (dense clusters near chest spawns)
 * - Chest-aware tree density (enough trees to unlock each chest type)
 *
 * Based on Cut Trees game design:
 * - Trees spaced 1-3 blocks apart in groves (not 10-30)
 * - Common chests: 12-18 trees within radius
 * - Rare chests: 25-35 trees within radius
 * - Epic/Mythic chests: 45-80 trees within radius
 */

import type { TreeId } from './trees';
import type { ChestTier } from './chests';
import { CHEST_CONSTANTS, CHESTS } from './chests';

type Vec3 = { x: number; y: number; z: number };

/** Block type IDs from map.json for biome detection */
const BLOCK_TYPES = {
  GRASS: 7,           // grass-block
  GRASS_FLOWER: 9,    // grass-flower-block
  PINE_GRASS: 6,      // grass-block-pine
  PINE_FLOWER: 8,     // grass-flower-block-pine
  SAND: 12,           // sand
  WATER: 16,          // water (avoid)
} as const;

type BiomeType = 'plains' | 'pine' | 'sand';

interface SpawnablePosition {
  x: number;
  y: number;  // Actual ground Y level
  z: number;
  biome: BiomeType;
}

/** Tree spawn point with all required data */
export interface AuthoredTreeSpawnPoint {
  id: string;
  position: Vec3;
  treeId: TreeId;
}

/** Chest spawn point with fixed tier and requirements */
export interface AuthoredChestSpawnPoint {
  id: string;
  position: Vec3;
  chestType: ChestTier;
  nearbyRadius: number;
  unlockCostTrees: number;
}

/** Configuration for tree placement patterns */
interface TreePlacementConfig {
  /** Spacing between trees in outer ring (1-2 blocks) */
  outerRingSpacing: number;
  /** Spacing between trees in clusters (1-2 blocks) */
  clusterSpacing: number;
  /** How far from map edge is the outer ring (blocks) */
  outerRingDistance: number;
  /** Buffer multiplier for trees around chests (1.5x = 50% more than needed) */
  chestTreeBuffer: number;
}

const DEFAULT_CONFIG: TreePlacementConfig = {
  outerRingSpacing: 2,
  clusterSpacing: 2,
  outerRingDistance: 8,
  chestTreeBuffer: 1.5, // 50% buffer for trees around chests
};

/** Tree counts per chest tier (with buffer) */
const TREES_PER_CHEST: Record<ChestTier, { min: number; target: number }> = {
  common: { min: 12, target: 18 },
  rare: { min: 25, target: 35 },
  epic: { min: 45, target: 65 },
  mythic: { min: 60, target: 80 },
};

/**
 * Extract valid spawn positions from the map data.
 * Finds the topmost ground block at each x,z and returns positions with no blocks above.
 */
export function getSpawnablePositions(mapData: { blocks: Record<string, number> }): SpawnablePosition[] {
  const blocks = mapData.blocks;
  
  // Spawnable ground types
  const plainsTypes = [BLOCK_TYPES.GRASS, BLOCK_TYPES.GRASS_FLOWER];
  const pineTypes = [BLOCK_TYPES.PINE_GRASS, BLOCK_TYPES.PINE_FLOWER];
  const sandTypes = [BLOCK_TYPES.SAND];
  const allSpawnable = [...plainsTypes, ...pineTypes, ...sandTypes];
  
  // First pass: find topmost spawnable block at each x,z
  const topBlocks = new Map<string, { x: number; y: number; z: number; typeId: number }>();
  
  Object.entries(blocks).forEach(([key, typeId]) => {
    const [x, y, z] = key.split(',').map(Number);
    
    // Only spawnable block types
    if (!allSpawnable.includes(typeId)) return;
    
    const xzKey = `${x},${z}`;
    const existing = topBlocks.get(xzKey);
    
    // Keep the highest Y at this x,z
    if (!existing || y > existing.y) {
      topBlocks.set(xzKey, { x, y, z, typeId });
    }
  });
  
  // Second pass: filter out positions with blocks above
  const positions: SpawnablePosition[] = [];
  
  topBlocks.forEach(({ x, y, z, typeId }) => {
    // Check no blocks above (don't spawn under existing trees/structures)
    const above1 = blocks[`${x},${y + 1},${z}`];
    const above2 = blocks[`${x},${y + 2},${z}`];
    if (above1 || above2) return;
    
    // Determine biome
    let biome: BiomeType = 'plains';
    if (pineTypes.includes(typeId)) biome = 'pine';
    else if (sandTypes.includes(typeId)) biome = 'sand';
    
    positions.push({ x, y, z, biome });
  });
  
  return positions;
}

/**
 * Calculate map bounds from spawnable positions
 */
function getMapBounds(positions: SpawnablePosition[]): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  for (const pos of positions) {
    if (pos.x < minX) minX = pos.x;
    if (pos.x > maxX) maxX = pos.x;
    if (pos.z < minZ) minZ = pos.z;
    if (pos.z > maxZ) maxZ = pos.z;
  }
  
  return { minX, maxX, minZ, maxZ };
}

/**
 * Check if a position is near the map edge (within outerRingDistance)
 */
function isNearEdge(pos: SpawnablePosition, bounds: ReturnType<typeof getMapBounds>, distance: number): boolean {
  return (
    pos.x <= bounds.minX + distance ||
    pos.x >= bounds.maxX - distance ||
    pos.z <= bounds.minZ + distance ||
    pos.z >= bounds.maxZ - distance
  );
}

/**
 * Get Y offset for tree type (trees need to be elevated above ground)
 */
function getTreeYOffset(treeId: TreeId): number {
  if (treeId.includes('_small')) return 3;
  if (treeId.includes('_medium')) return 4;
  return 5; // big trees and palm
}

/**
 * Choose tree type based on biome
 */
function chooseTreeForBiome(biome: BiomeType, rng: () => number = Math.random): TreeId {
  const rand = rng();
  
  if (biome === 'pine') {
    if (rand < 0.4) return 'pine_small';
    if (rand < 0.75) return 'pine_medium';
    return 'pine_big';
  } else if (biome === 'sand') {
    return 'palm';
  } else {
    // Plains: oak trees
    if (rand < 0.4) return 'oak_small';
    if (rand < 0.75) return 'oak_medium';
    return 'oak_big';
  }
}

/**
 * Calculate distance squared between two points (2D, ignoring Y)
 */
function distSq2D(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

/**
 * Generate chest spawn points with assigned tiers.
 * Places chests strategically:
 * - Common chests scattered throughout
 * - Rare chests in moderate clusters
 * - Epic/Mythic chests in prime locations with good tree access
 */
export function generateChestSpawnPoints(
  positions: SpawnablePosition[],
  targetCount: number = CHEST_CONSTANTS.SPAWN_POINTS_PER_WORLD
): AuthoredChestSpawnPoint[] {
  const points: AuthoredChestSpawnPoint[] = [];
  const usedSpots = new Set<string>();
  
  // Shuffle for randomness
  const shuffled = [...positions].sort(() => Math.random() - 0.5);
  
  // Calculate target counts per tier based on spawn weights
  const tierTargets: Record<ChestTier, number> = {
    common: Math.floor(targetCount * 0.46),
    rare: Math.floor(targetCount * 0.33),
    epic: Math.floor(targetCount * 0.16),
    mythic: Math.floor(targetCount * 0.05),
  };
  
  const tierCounts: Record<ChestTier, number> = {
    common: 0,
    rare: 0,
    epic: 0,
    mythic: 0,
  };
  
  // Assign tiers in order (mythic/epic first to get best spots)
  const tierOrder: ChestTier[] = ['mythic', 'epic', 'rare', 'common'];
  
  let id = 0;
  for (const tier of tierOrder) {
    for (const pos of shuffled) {
      if (tierCounts[tier] >= tierTargets[tier]) break;
      
      // Enforce ~12 block spacing for higher tiers, ~8 for common
      const spacing = tier === 'common' ? 8 : 12;
      const gridKey = `${Math.floor(pos.x / spacing)},${Math.floor(pos.z / spacing)}`;
      if (usedSpots.has(gridKey)) continue;
      usedSpots.add(gridKey);
      
      const chestDef = CHESTS[tier];
      
      points.push({
        id: `chest-${id++}`,
        position: { x: pos.x, y: pos.y + 2, z: pos.z }, // 2 above ground
        chestType: tier,
        nearbyRadius: CHEST_CONSTANTS.NEARBY_TREES_RADIUS,
        unlockCostTrees: chestDef.unlockCost,
      });
      
      tierCounts[tier]++;
    }
  }
  
  console.log(`[WorldGen] Chest tier distribution: ${JSON.stringify(tierCounts)}`);
  return points;
}

/**
 * Generate tree spawn points using authored patterns:
 * 1. Outer ring tree line (continuous belt along map edge)
 * 2. Dense clusters around each chest spawn
 * 3. Interior groves for additional density
 */
export function generateTreeSpawnPoints(
  positions: SpawnablePosition[],
  chestSpawnPoints: AuthoredChestSpawnPoint[],
  config: TreePlacementConfig = DEFAULT_CONFIG
): AuthoredTreeSpawnPoint[] {
  const points: AuthoredTreeSpawnPoint[] = [];
  const usedPositions = new Set<string>(); // Track used x,z positions
  
  const bounds = getMapBounds(positions);
  const positionMap = new Map<string, SpawnablePosition>();
  
  // Index positions by x,z for quick lookup
  for (const pos of positions) {
    positionMap.set(`${pos.x},${pos.z}`, pos);
  }
  
  let treeId = 0;

  /** Spawn exclusion: no trees within this radius of player spawn (0, 0) */
  const SPAWN_EXCLUSION_RADIUS_SQ = 8 * 8; // 8 blocks
  
  /**
   * Try to add a tree at a position
   */
  function tryAddTree(x: number, z: number, reason: string): boolean {
    const key = `${x},${z}`;
    if (usedPositions.has(key)) return false;
    
    const pos = positionMap.get(key);
    if (!pos) return false;

    // Reject trees too close to player spawn (0, 0)
    if (x * x + z * z <= SPAWN_EXCLUSION_RADIUS_SQ) return false;
    
    usedPositions.add(key);
    
    const treeType = chooseTreeForBiome(pos.biome);
    const yOffset = getTreeYOffset(treeType);
    
    points.push({
      id: `tree-${treeId++}`,
      position: { x: pos.x, y: pos.y + yOffset, z: pos.z },
      treeId: treeType,
    });
    
    return true;
  }
  
  // ==========================================
  // PHASE 1: Outer ring tree line
  // ==========================================
  console.log('[WorldGen] Phase 1: Creating outer ring tree line...');
  
  const ringDistance = config.outerRingDistance;
  const ringSpacing = config.outerRingSpacing;
  
  // Walk the perimeter and place trees
  for (let x = bounds.minX; x <= bounds.maxX; x += ringSpacing) {
    // Top edge
    for (let z = bounds.minZ; z <= bounds.minZ + ringDistance; z += ringSpacing) {
      tryAddTree(x, z, 'outer-ring-top');
    }
    // Bottom edge
    for (let z = bounds.maxZ - ringDistance; z <= bounds.maxZ; z += ringSpacing) {
      tryAddTree(x, z, 'outer-ring-bottom');
    }
  }
  
  for (let z = bounds.minZ; z <= bounds.maxZ; z += ringSpacing) {
    // Left edge
    for (let x = bounds.minX; x <= bounds.minX + ringDistance; x += ringSpacing) {
      tryAddTree(x, z, 'outer-ring-left');
    }
    // Right edge
    for (let x = bounds.maxX - ringDistance; x <= bounds.maxX; x += ringSpacing) {
      tryAddTree(x, z, 'outer-ring-right');
    }
  }
  
  console.log(`[WorldGen] Outer ring trees: ${points.length}`);
  
  // ==========================================
  // PHASE 2: Dense clusters around each chest
  // ==========================================
  console.log('[WorldGen] Phase 2: Creating chest-aware clusters...');
  
  const chestTreeCounts = new Map<string, number>();
  
  for (const chest of chestSpawnPoints) {
    const target = TREES_PER_CHEST[chest.chestType].target;
    const radius = chest.nearbyRadius;
    let treesInRadius = 0;
    
    // Count existing trees already in radius
    for (const tree of points) {
      if (distSq2D(tree.position, chest.position) <= radius * radius) {
        treesInRadius++;
      }
    }
    
    // Add more trees in concentric circles until we hit target
    const spacing = config.clusterSpacing;
    
    // Start from center and spiral outward
    for (let r = 2; r <= radius && treesInRadius < target; r += spacing) {
      // Walk a circle at this radius
      const circumference = 2 * Math.PI * r;
      const steps = Math.max(8, Math.floor(circumference / spacing));
      
      for (let i = 0; i < steps && treesInRadius < target; i++) {
        const angle = (i / steps) * 2 * Math.PI;
        const x = Math.round(chest.position.x + r * Math.cos(angle));
        const z = Math.round(chest.position.z + r * Math.sin(angle));
        
        if (tryAddTree(x, z, `chest-cluster-${chest.id}`)) {
          treesInRadius++;
        }
      }
    }
    
    chestTreeCounts.set(chest.id, treesInRadius);
    
    if (treesInRadius < TREES_PER_CHEST[chest.chestType].min) {
      console.warn(`[WorldGen] Warning: Chest ${chest.id} (${chest.chestType}) only has ${treesInRadius} trees, needs ${TREES_PER_CHEST[chest.chestType].min}`);
    }
  }
  
  console.log(`[WorldGen] After chest clusters: ${points.length} trees`);
  
  // ==========================================
  // PHASE 3: Interior groves (fill remaining areas)
  // ==========================================
  console.log('[WorldGen] Phase 3: Creating interior groves...');
  
  const groveSpacing = 3; // Slightly more sparse than clusters
  
  // Find positions not near edges and not already used
  const interiorPositions = positions.filter(pos => {
    const key = `${pos.x},${pos.z}`;
    if (usedPositions.has(key)) return false;
    if (isNearEdge(pos, bounds, ringDistance + 2)) return false;
    return true;
  });
  
  // Shuffle and add with spacing
  const shuffledInterior = interiorPositions.sort(() => Math.random() - 0.5);
  const usedGroveSpots = new Set<string>();
  
  for (const pos of shuffledInterior) {
    // Enforce grove spacing
    const gridKey = `${Math.floor(pos.x / groveSpacing)},${Math.floor(pos.z / groveSpacing)}`;
    if (usedGroveSpots.has(gridKey)) continue;
    usedGroveSpots.add(gridKey);
    
    tryAddTree(pos.x, pos.z, 'interior-grove');
  }
  
  console.log(`[WorldGen] Final tree count: ${points.length}`);
  
  // ==========================================
  // Validation: Check tree counts per chest
  // ==========================================
  console.log('[WorldGen] Validating tree counts per chest...');
  
  for (const chest of chestSpawnPoints) {
    const radius = chest.nearbyRadius;
    const radiusSq = radius * radius;
    let count = 0;
    
    for (const tree of points) {
      if (distSq2D(tree.position, chest.position) <= radiusSq) {
        count++;
      }
    }
    
    const required = TREES_PER_CHEST[chest.chestType];
    const status = count >= required.min ? '✓' : '✗';
    console.log(`[WorldGen] ${status} Chest ${chest.id} (${chest.chestType}): ${count} trees (need ${required.min}-${required.target})`);
  }
  
  return points;
}

/**
 * Generate both chest and tree spawn points with proper coordination
 */
export function generateWorldSpawnPoints(
  mapData: { blocks: Record<string, number> },
  chestCount: number = CHEST_CONSTANTS.SPAWN_POINTS_PER_WORLD
): { trees: AuthoredTreeSpawnPoint[]; chests: AuthoredChestSpawnPoint[] } {
  console.log('[WorldGen] Starting world generation...');
  
  // Get all spawnable positions from map
  const positions = getSpawnablePositions(mapData);
  console.log(`[WorldGen] Found ${positions.length} spawnable positions`);
  
  // Generate chest spawn points first (trees are placed around them)
  const chests = generateChestSpawnPoints(positions, chestCount);
  console.log(`[WorldGen] Generated ${chests.length} chest spawn points`);
  
  // Generate tree spawn points with proper patterns
  const trees = generateTreeSpawnPoints(positions, chests);
  console.log(`[WorldGen] Generated ${trees.length} tree spawn points`);
  
  return { trees, chests };
}
