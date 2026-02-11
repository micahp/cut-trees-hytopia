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
import { TREES, TREE_IDS, AXES, CHESTS, RARITY_DISPLAY_NAMES, loadPlayerData, openChest, applyChestRewards, generateWorldSpawnPoints } from './src/game';
import type { TreeId, ChestTier, AxeId } from './src/game';

/**
 * Pre-computed axe definitions for UI (sent once to each client).
 * Includes all info the inventory panel needs to render.
 */
const ALL_AXES_FOR_UI = Object.values(AXES).map(axe => ({
  id: axe.id,
  name: axe.name,
  rarity: axe.rarity,
  damage: axe.damage,
  cooldown: axe.cooldown,
  areaRadius: axe.areaRadius,
  perk: axe.perks?.extraRollChance
    ? `${Math.round(axe.perks.extraRollChance * 100)}% chance for bonus chest roll`
    : null,
}));

// World generation is now handled by src/game/worldGeneration.ts
// with proper tree clustering around chests and outer ring patterns

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

  // Generate world spawn points using authored patterns
  // (outer ring trees, chest-aware clusters, interior groves)
  const { trees: treeSpawnPoints, chests: chestSpawnPoints } = generateWorldSpawnPoints(
    worldMap as { blocks: Record<string, number> },
    40 // Target chest count
  );
  
  // Spawn trees
  treeManager.addSpawnPoints(treeSpawnPoints);
  treeManager.spawnAll();
  console.log(`[CutTrees] Spawned ${treeSpawnPoints.length} trees`);
  
  // Debug: show sample tree positions
  console.log('[CutTrees] Sample tree positions (x, y, z):');
  treeSpawnPoints.slice(0, 5).forEach(p => {
    console.log(`  ${p.treeId}: (${p.position.x}, ${p.position.y}, ${p.position.z})`);
  });

  // Spawn chests with authored tiers
  chestManager.addSpawnPoints(chestSpawnPoints);
  chestManager.spawnAll();
  console.log(`[CutTrees] Spawned ${chestSpawnPoints.length} chests`);
  
  // Debug: show chest tier distribution
  const tierCounts = chestSpawnPoints.reduce((acc, p) => {
    acc[p.chestType] = (acc[p.chestType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`[CutTrees] Chest tiers: ${JSON.stringify(tierCounts)}`);
  
  // Debug: show sample chest positions
  console.log('[CutTrees] Sample chest positions (type, x, y, z):');
  chestSpawnPoints.slice(0, 5).forEach(p => {
    console.log(`  ${p.chestType}: (${p.position.x}, ${p.position.y}, ${p.position.z})`);
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
  function sendUIStateUpdate(player: any, includeAxeDefs: boolean = false) {
    const data = PlayerManager.loadPlayerData(player);
    const session = PlayerManager.getSession(player);
    const axe = AXES[data.equippedAxe];
    
    const payload: Record<string, any> = {
      type: 'stateUpdate',
      power: data.power,
      shards: data.shards,
      equippedAxe: axe?.name ?? 'Unknown',
      equippedAxeId: data.equippedAxe,
      ownedAxes: data.ownedAxes,
      collectedChests: session?.collectedChests.map(c => ({
        tier: c.tier,
        spawnPointId: c.spawnPointId,
      })) ?? [],
    };

    // Send axe definitions on first update (so UI can render inventory)
    if (includeAxeDefs) {
      payload.allAxes = ALL_AXES_FOR_UI;
    }

    player.ui.sendData(payload);
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

    // Apply all rewards to the in-memory data object (mutates playerData)
    applyChestRewards(playerData, results);

    // Single atomic save — avoids race conditions from multiple async
    // setPersistedData calls that each load-then-save independently.
    // applyChestRewards already mutated ownedAxes, shards, and stats,
    // so we persist all changed top-level keys in one call.
    PlayerManager.savePlayerData(player, {
      ownedAxes: playerData.ownedAxes,
      shards: playerData.shards,
      stats: playerData.stats,
    });

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
   * Handle click on a locked axe in inventory — tell player which chests can drop it
   */
  function handleLockedAxeClick(player: any, axeId: string) {
    const axe = AXES[axeId as AxeId];
    if (!axe) return;

    // Find which chest tiers can drop this axe's rarity (non-zero weight)
    const sources = (Object.entries(CHESTS) as Array<[ChestTier, typeof CHESTS[ChestTier]]>)
      .filter(([, chest]) => chest.dropTable[axe.rarity] > 0)
      .map(([, chest]) => `${chest.name} (${chest.dropTable[axe.rarity]}%)`)
      .join(', ');

    const rarityLabel = RARITY_DISPLAY_NAMES[axe.rarity];
    const hint = sources
      ? `${axe.name} (${rarityLabel}) — found in: ${sources}.`
      : `${axe.name} (${rarityLabel}) — not currently available from chests.`;

    world.chatManager.sendPlayerMessage(player, hint, 'FFD700');
  }

  /**
   * Handle equipping an axe from the inventory UI
   */
  function handleEquipAxe(player: any, axeId: string) {
    const playerData = PlayerManager.loadPlayerData(player);

    // Validate axe exists
    if (!AXES[axeId as AxeId]) {
      world.chatManager.sendPlayerMessage(player, `Unknown axe: ${axeId}`, 'FF6B6B');
      return;
    }

    // Validate player owns it
    if (!playerData.ownedAxes[axeId as AxeId]) {
      world.chatManager.sendPlayerMessage(player, `You don't own that axe!`, 'FF6B6B');
      return;
    }

    // Already equipped?
    if (playerData.equippedAxe === axeId) {
      return;
    }

    // Equip it
    const playerEntity = world.entityManager.getPlayerEntitiesByPlayer(player)[0];
    if (playerEntity) {
      PlayerManager.equipAxe(player, playerEntity, world, axeId as AxeId);
      const axeDef = AXES[axeId as AxeId];
      world.chatManager.sendPlayerMessage(player, `Equipped: ${axeDef.name}`, '00FF00');
      sendUIStateUpdate(player);
    }
  }

  /**
   * Handle player joining the game
   */
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    console.log(`[CutTrees] Player joined: ${player.username}`);
    
    // Load/initialize player data
    const playerData = PlayerManager.loadPlayerData(player);
    
    // Data integrity: ensure equipped axe is in ownedAxes.
    // Race conditions with async setPersistedData can desync these.
    if (AXES[playerData.equippedAxe] && !playerData.ownedAxes[playerData.equippedAxe]) {
      console.warn(`[CutTrees] Integrity fix: ${player.username} has equippedAxe="${playerData.equippedAxe}" but doesn't own it — adding to ownedAxes`);
      playerData.ownedAxes[playerData.equippedAxe] = 1;
      PlayerManager.savePlayerData(player, { ownedAxes: playerData.ownedAxes });
    }
    
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
      if (data?.type === 'equipAxe') {
        handleEquipAxe(player, data.axeId);
      }
      if (data?.type === 'lockedAxeClick') {
        handleLockedAxeClick(player, data.axeId);
      }
    });

    // Send initial state to UI after a short delay (let UI load)
    // Include axe definitions on first load so inventory can render
    setTimeout(() => {
      sendUIStateUpdate(player, true);
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

    // Re-send full state + axe defs after UI reloads (same as initial join)
    setTimeout(() => {
      sendUIStateUpdate(player, true);
    }, 500);
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
