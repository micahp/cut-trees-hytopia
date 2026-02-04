/**
 * Cut Trees - HYTOPIA Game Server
 * 
 * A tree-chopping progression game with:
 * - Multiple axe tiers (Common → Exotic)
 * - AoE chopping mechanics
 * - Chest rewards with rarity drops
 * - Player power progression
 * - Persisted data across sessions
 */

import {
  startServer,
  Audio,
  DefaultPlayerEntity,
  PlayerEvent,
  PlayerUIEvent,
} from 'hytopia';

import worldMap from './assets/map.json';

// Game systems
import {
  WorldLoopTimerManager,
  PlayerManager,
  TreeManager,
  ChestManager,
  ChoppingSystem,
} from './src/systems';
import type { TreeSpawnPoint, ChestSpawnPoint } from './src/systems';

// Game config
import { TREES, TREE_IDS, AXES, loadPlayerData, openChest, applyChestRewards } from './src/game';
import type { TreeId, ChestTier } from './src/game';

/**
 * Block type IDs from map.json for biome detection
 */
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

/**
 * Extract valid spawn positions from the map data.
 * Finds the topmost ground block at each x,z and returns positions with no blocks above.
 */
function getSpawnablePositions(): SpawnablePosition[] {
  const blocks = (worldMap as any).blocks as Record<string, number>;
  
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
 * Generate spawn points for trees using map data.
 * Biome-appropriate trees with ~4 block spacing.
 */
function generateTreeSpawnPoints(): TreeSpawnPoint[] {
  const allPositions = getSpawnablePositions();
  const points: TreeSpawnPoint[] = [];
  const usedSpots = new Set<string>();
  
  // Shuffle for randomness
  const shuffled = allPositions.sort(() => Math.random() - 0.5);
  
  let id = 0;
  for (const pos of shuffled) {
    // Enforce ~4 block spacing
    const gridKey = `${Math.floor(pos.x / 4)},${Math.floor(pos.z / 4)}`;
    if (usedSpots.has(gridKey)) continue;
    usedSpots.add(gridKey);
    
    // Choose tree type based on biome and tier weighting
    const rand = Math.random();
    let treeId: TreeId;
    
    if (pos.biome === 'pine') {
      // Pine forest: pine trees
      if (rand < 0.4) treeId = 'pine_small';
      else if (rand < 0.75) treeId = 'pine_medium';
      else treeId = 'pine_big';
    } else if (pos.biome === 'sand') {
      // Beach/sand: palm trees
      treeId = 'palm';
    } else {
      // Plains: oak trees (small more common)
      if (rand < 0.4) treeId = 'oak_small';
      else if (rand < 0.75) treeId = 'oak_medium';
      else treeId = 'oak_big';
    }
    
    // Y offset varies by tree size
    let yOffset = 5; // big trees and palm
    if (treeId.includes('_small')) yOffset = 3;      // small trees: down 2 more
    else if (treeId.includes('_medium')) yOffset = 4; // medium trees: down 1 more
    
    points.push({
      id: `tree-${id++}`,
      position: { x: pos.x, y: pos.y + yOffset, z: pos.z },
      treeId,
    });
  }
  
  return points;
}

/**
 * Generate spawn points for chests using map data.
 * ~8 block spacing, scattered across all biomes.
 */
function generateChestSpawnPoints(): ChestSpawnPoint[] {
  const allPositions = getSpawnablePositions();
  const points: ChestSpawnPoint[] = [];
  const usedSpots = new Set<string>();
  
  // Shuffle for randomness
  const shuffled = allPositions.sort(() => Math.random() - 0.5);
  
  let id = 0;
  for (const pos of shuffled) {
    // Enforce ~8 block spacing (more sparse than trees)
    const gridKey = `${Math.floor(pos.x / 8)},${Math.floor(pos.z / 8)}`;
    if (usedSpots.has(gridKey)) continue;
    usedSpots.add(gridKey);
    
    points.push({
      id: `chest-${id++}`,
      position: { x: pos.x, y: pos.y + 2, z: pos.z }, // spawn 2 above ground (floor level)
    });
  }
  
  return points;
}

startServer(world => {
  console.log('[CutTrees] Starting server...');
  
  // Initialize game systems
  const timers = new WorldLoopTimerManager(world);
  const treeManager = new TreeManager(world, timers);
  const chestManager = new ChestManager(world, timers);
  const choppingSystem = new ChoppingSystem(world, treeManager, chestManager);
  
  // Set up chopping input handlers
  choppingSystem.initialize();

  // Load our map
  world.loadMap(worldMap);

  // Generate and spawn trees
  const treeSpawnPoints = generateTreeSpawnPoints();
  treeManager.addSpawnPoints(treeSpawnPoints);
  treeManager.spawnAll();
  console.log(`[CutTrees] Spawned ${treeSpawnPoints.length} trees`);
  
  // Debug: show sample tree positions
  console.log('[CutTrees] Sample tree positions (x, y, z):');
  treeSpawnPoints.slice(0, 5).forEach(p => {
    console.log(`  ${p.treeId}: (${p.position.x}, ${p.position.y}, ${p.position.z})`);
  });

  // Generate and spawn chests
  const chestSpawnPoints = generateChestSpawnPoints();
  chestManager.addSpawnPoints(chestSpawnPoints);
  chestManager.spawnAll();
  console.log(`[CutTrees] Spawned ${chestSpawnPoints.length} chests`);
  
  // Debug: show sample chest positions
  console.log('[CutTrees] Sample chest positions (x, y, z):');
  chestSpawnPoints.slice(0, 5).forEach(p => {
    console.log(`  chest: (${p.position.x}, ${p.position.y}, ${p.position.z})`);
  });

  // Wire up tree chop tracking for chest unlocks
  treeManager.setOnTreeChopped((tree, player) => {
    chestManager.trackTreeChop(player, tree.position);
    sendUIStateUpdate(player);
  });

  // Wire up chest collection callback for UI updates
  chestManager.setOnChestCollected((player, chest) => {
    sendUIStateUpdate(player);
  });

  /**
   * Send UI state update to player
   */
  function sendUIStateUpdate(player: any) {
    const data = PlayerManager.loadPlayerData(player);
    const session = PlayerManager.getSession(player);
    const axe = AXES[data.equippedAxe];
    
    player.ui.sendData({
      type: 'stateUpdate',
      power: data.power,
      shards: data.shards,
      equippedAxe: axe?.name ?? 'Unknown',
      collectedChests: session?.collectedChests.map(c => ({
        tier: c.tier,
        spawnPointId: c.spawnPointId,
      })) ?? [],
    });
  }

  /**
   * Handle opening a chest from UI
   */
  function handleOpenChest(player: any, index: number) {
    const session = PlayerManager.getSession(player);
    if (!session || index < 0 || index >= session.collectedChests.length) {
      return;
    }

    // Get the chest from inventory
    const chest = session.collectedChests[index];
    const chestTier = chest.tier as ChestTier;

    // Remove from inventory
    session.collectedChests.splice(index, 1);

    // Roll loot using the loot system
    const playerData = PlayerManager.loadPlayerData(player);
    const results = openChest(chestTier, playerData);

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

    // Format results for UI
    const uiResults = results.map(result => {
      if (result.kind === 'axe') {
        const axe = AXES[result.axeId];
        return {
          kind: 'axe',
          axeId: result.axeId,
          axeName: axe.name,
          rarity: result.rarity,
        };
      } else {
        const axe = AXES[result.sourceAxeId];
        return {
          kind: 'shards',
          amount: result.amount,
          axeName: axe.name,
          rarity: result.rarity,
        };
      }
    });

    // Send loot results to UI
    player.ui.sendData({
      type: 'lootResults',
      results: uiResults,
    });

    // Send updated state
    sendUIStateUpdate(player);
  }

  /**
   * Handle player joining the game
   */
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    console.log(`[CutTrees] Player joined: ${player.username}`);
    
    // Load/initialize player data
    const playerData = PlayerManager.loadPlayerData(player);
    
    // Initialize session
    PlayerManager.initSession(player);

    // Create player entity
    const playerEntity = new DefaultPlayerEntity({
      player,
      name: player.username,
    });
    playerEntity.spawn(world, { x: 0, y: 10, z: 0 });

    // Equip their saved axe
    PlayerManager.equipAxe(player, playerEntity, world, playerData.equippedAxe);

    // Load game UI
    player.ui.load('ui/index.html');

    // Set up UI event handlers
    player.ui.on(PlayerUIEvent.DATA, ({ data }: any) => {
      if (data?.type === 'openChest') {
        handleOpenChest(player, data.index);
      }
      if (data?.type === 'requestChop') {
        // Auto-chop: find and damage nearest tree
        const chopped = choppingSystem.autoChop(player);
        if (chopped) {
          sendUIStateUpdate(player);
        }
      }
    });

    // Send initial state to UI after a short delay (let UI load)
    setTimeout(() => {
      sendUIStateUpdate(player);
    }, 500);

    // Welcome messages
    const axe = AXES[playerData.equippedAxe];
    world.chatManager.sendPlayerMessage(player, '🌲 Welcome to Cut Trees!', '00FF00');
    world.chatManager.sendPlayerMessage(player, `Power: ${playerData.power.toLocaleString()} | Shards: ${playerData.shards}`, 'FFD700');
    world.chatManager.sendPlayerMessage(player, `Equipped: ${axe.name} (${axe.rarity})`, '4FC3F7');
    world.chatManager.sendPlayerMessage(player, 'Left-click to chop trees! Click "Chests" to open collected chests.', 'FFFFFF');
  });

  /**
   * Handle player leaving
   */
  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    console.log(`[CutTrees] Player left: ${player.username}`);
    
    // Clean up session
    PlayerManager.clearSession(player);
    
    // Despawn player entities
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => entity.despawn());
  });

  /**
   * Handle reconnection
   */
  world.on(PlayerEvent.RECONNECTED_WORLD, ({ player }) => {
    player.ui.load('ui/index.html');
  });

  /**
   * Chat commands for testing/debugging
   */
  
  // /stats - Show player stats
  world.chatManager.registerCommand('/stats', player => {
    const data = PlayerManager.loadPlayerData(player);
    world.chatManager.sendPlayerMessage(player, '--- Your Stats ---', 'FFD700');
    world.chatManager.sendPlayerMessage(player, `Power: ${data.power.toLocaleString()}`, 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, `Shards: ${data.shards}`, 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, `Trees Chopped: ${data.stats.treesChopped}`, 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, `Chests Opened: ${data.stats.chestsOpened}`, 'FFFFFF');
    
    const ownedAxes = Object.keys(data.ownedAxes).filter(k => data.ownedAxes[k as keyof typeof data.ownedAxes]);
    world.chatManager.sendPlayerMessage(player, `Owned Axes: ${ownedAxes.join(', ')}`, 'FFFFFF');
  });

  // /equip <axe> - Equip an axe
  world.chatManager.registerCommand('/equip', (player, args) => {
    const axeId = (Array.isArray(args) ? args[0] : args) as keyof typeof AXES;
    const data = PlayerManager.loadPlayerData(player);
    
    if (!axeId || !AXES[axeId]) {
      world.chatManager.sendPlayerMessage(player, `Unknown axe: ${axeId}`, 'FF6B6B');
      world.chatManager.sendPlayerMessage(player, `Available: ${Object.keys(AXES).join(', ')}`, 'FFFFFF');
      return;
    }
    
    if (!data.ownedAxes[axeId]) {
      world.chatManager.sendPlayerMessage(player, `You don't own the ${AXES[axeId].name}!`, 'FF6B6B');
      return;
    }
    
    const playerEntity = world.entityManager.getPlayerEntitiesByPlayer(player)[0];
    if (playerEntity) {
      PlayerManager.equipAxe(player, playerEntity, world, axeId);
      world.chatManager.sendPlayerMessage(player, `Equipped: ${AXES[axeId].name}`, '00FF00');
    }
  });

  // /give <axe> - Debug: give an axe
  world.chatManager.registerCommand('/give', (player, args) => {
    const axeId = (Array.isArray(args) ? args[0] : args) as keyof typeof AXES;
    
    if (!axeId || !AXES[axeId]) {
      world.chatManager.sendPlayerMessage(player, `Unknown axe: ${axeId}`, 'FF6B6B');
      return;
    }
    
    const granted = PlayerManager.grantAxe(player, axeId);
    if (granted) {
      world.chatManager.sendPlayerMessage(player, `Granted: ${AXES[axeId].name}!`, '00FF00');
    } else {
      world.chatManager.sendPlayerMessage(player, `You already own ${AXES[axeId].name}`, 'FF6B6B');
    }
  });

  // /power <amount> - Debug: add power
  world.chatManager.registerCommand('/power', (player, args) => {
    const argStr = Array.isArray(args) ? args[0] : args;
    const amount = parseInt(argStr, 10) || 1000;
    const newPower = PlayerManager.awardPower(player, amount);
    world.chatManager.sendPlayerMessage(player, `Power: ${newPower.toLocaleString()} (+${amount})`, '00FF00');
  });

  // /rocket - Fun easter egg
  world.chatManager.registerCommand('/rocket', player => {
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => {
      entity.applyImpulse({ x: 0, y: 20, z: 0 });
    });
  });

  // Play ambient music
  new Audio({
    uri: 'audio/music/hytopia-main-theme.mp3',
    loop: true,
    volume: 0.1,
  }).play(world);

  console.log('[CutTrees] Server ready!');
});
