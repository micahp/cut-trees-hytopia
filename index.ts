/**
 * Cut Trees - HYTOPIA Game Server
 * 
 * A tree-chopping progression game with:
 * - Multiplayer lobby (elevated platform at y=50, box-seats view)
 * - Multiple axe tiers (Common -> Exotic)
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

import worldMap from './assets/arena-map.json';

// Game systems
import {
  WorldLoopTimerManager,
  PlayerManager,
  TreeManager,
  ChestManager,
  ChoppingSystem,
} from './src/systems';
import type { TreeSpawnPoint, ChestSpawnPoint } from './src/systems';
import {
  buildLobbyPlatform,
  addArenaBlocksAtOffset,
  isOnLobbyPad,
  getAreaSpawnPosition,
  AREA_STRIDE,
  LOBBY_SPAWN,
  LOBBY_SPAWN_ROTATION,
  PAD_Z_CENTER,
} from './src/systems/lobbyGameRouter';

// Game config
import { TREES, TREE_IDS, AXES, CHESTS, RARITY_DISPLAY_NAMES, loadPlayerData, repairPlayerData, openChest, applyChestRewards, generateWorldSpawnPoints } from './src/game';
import type { TreeId, ChestTier, AxeId } from './src/game';

/**
 * Pre-computed axe definitions for UI (sent once to each client).
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

// ─── Server entry ────────────────────────────────────────────────────────────

startServer(world => {
  console.log('[CutTrees] Starting server...');

  // Load the arena map at ground level (y=0). This also registers block types.
  world.loadMap(worldMap);

  // Build the elevated lobby platform (y=50) in the SAME world.
  buildLobbyPlatform(world);

  // ── Game systems (all bound to this single world) ──────────────────────────
  const timers = new WorldLoopTimerManager(world);
  const treeManager = new TreeManager(world, timers);
  const chestManager = new ChestManager(world, timers);
  const choppingSystem = new ChoppingSystem(world, treeManager, chestManager);
  choppingSystem.initialize();

  // Area 0 spawn points (base arena at origin)
  const { trees: treeSpawnPoints, chests: chestSpawnPoints } = generateWorldSpawnPoints(
    worldMap as { blocks: Record<string, number> },
    40,
  );
  treeManager.addSpawnPoints(treeSpawnPoints);
  chestManager.addSpawnPoints(chestSpawnPoints);
  treeManager.spawnAll();
  chestManager.spawnAll();
  console.log(`[CutTrees] Arena ready: ${treeSpawnPoints.length} trees, ${chestSpawnPoints.length} chests`);

  // ── Player state tracking ──────────────────────────────────────────────────
  /** Players currently in the lobby (not yet teleported to an arena). */
  const lobbyPlayers = new Set<string>();
  /** Next area index to assign when a player starts. */
  let nextAreaIndex = 0;

  // Tree/chest callbacks
  treeManager.setOnTreeChopped((tree, player) => {
    chestManager.trackTreeChop(player, tree.position);
    sendUIStateUpdate(player);
    // Send floating reward popup to client
    player.ui.sendData({
      type: 'chopReward',
      power: tree.powerReward,
      shards: tree.shardReward,
    });
  });
  chestManager.setOnChestCollected((player) => {
    sendUIStateUpdate(player);
  });

  // ── Send player to arena ───────────────────────────────────────────────────

  /**
   * Teleport a player from the lobby to their own arena area.
   * - Despawns lobby entity
   * - Adds new arena blocks if areaIndex > 0
   * - Spawns a new entity at the arena centre
   * - Initialises game session + UI
   */
  function sendPlayerToArena(player: any): void {
    const playerId = player.id ?? player.username;
    if (!lobbyPlayers.has(playerId)) return; // already sent or not in lobby
    lobbyPlayers.delete(playerId);

    // Despawn lobby entity
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach((e: any) => e.despawn());

    // Assign area
    const areaIndex = nextAreaIndex++;
    if (areaIndex > 0) {
      const offsetX = areaIndex * AREA_STRIDE;
      addArenaBlocksAtOffset(world, worldMap as { blocks: Record<string, number> }, offsetX);
      const { trees: baseTrees, chests: baseChests } = generateWorldSpawnPoints(
        worldMap as { blocks: Record<string, number> },
        40,
      );
      const treePoints: TreeSpawnPoint[] = baseTrees.map((t, i) => ({
        ...t,
        id: `tree-area${areaIndex}-${i}`,
        position: { x: t.position.x + offsetX, y: t.position.y, z: t.position.z },
      }));
      const chestPoints: ChestSpawnPoint[] = baseChests.map((c, i) => ({
        ...c,
        id: `chest-area${areaIndex}-${i}`,
        position: { x: c.position.x + offsetX, y: c.position.y, z: c.position.z },
      }));
      treeManager.addSpawnPoints(treePoints);
      chestManager.addSpawnPoints(chestPoints);
      treeManager.spawnSpawnPoints(treePoints);
      chestManager.spawnSpawnPoints(chestPoints);
    }

    const spawnPos = getAreaSpawnPosition(areaIndex);

    // Load / repair player data
    const playerData = PlayerManager.loadPlayerData(player);
    const repairs = repairPlayerData(playerData);
    if (Object.keys(repairs).length > 0) {
      PlayerManager.savePlayerData(player, repairs);
    }
    PlayerManager.initSession(player);

    // Spawn player entity at arena
    const playerEntity = new DefaultPlayerEntity({ player, name: player.username });
    playerEntity.spawn(world, spawnPos);
    player.camera.setAttachedToEntity(playerEntity); // Re-attach camera; it was bound to the despawned lobby entity
    PlayerManager.equipAxe(player, playerEntity, world, playerData.equippedAxe);

    // Tell UI to switch from lobby to game mode
    player.ui.sendData({ type: 'enterGame' });

    // Send full game state (with axe defs)
    setTimeout(() => sendUIStateUpdate(player, true), 300);

    const axe = AXES[playerData.equippedAxe];
    world.chatManager.sendPlayerMessage(player, '🌲 Welcome to Cut Trees!', '00FF00');
    world.chatManager.sendPlayerMessage(player, `Power: ${playerData.power.toLocaleString()} | Shards: ${playerData.shards}`, 'FFD700');
    world.chatManager.sendPlayerMessage(player, `Equipped: ${axe.name} (${axe.rarity})`, '4FC3F7');
    world.chatManager.sendPlayerMessage(player, 'Left-click to chop trees! Click "Chests" to open collected chests.', 'FFFFFF');

    console.log(`[CutTrees] ${player.username} teleported to area ${areaIndex}`);
  }

  // ── Lobby pad proximity check ──────────────────────────────────────────────

  setInterval(() => {
    const allPlayerEntities = world.entityManager.getAllPlayerEntities();
    for (const pe of allPlayerEntities) {
      const pid = pe.player?.id ?? pe.player?.username;
      if (!pid || !lobbyPlayers.has(pid)) continue;
      if (isOnLobbyPad(pe.position)) {
        sendPlayerToArena(pe.player);
      }
    }
  }, 250);

  // ── UI helpers ─────────────────────────────────────────────────────────────

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
    if (includeAxeDefs) payload.allAxes = ALL_AXES_FOR_UI;
    player.ui.sendData(payload);
  }

  function handleOpenChest(player: any, index: unknown) {
    const session = PlayerManager.getSession(player);
    if (!session) { sendUIStateUpdate(player); return; }
    const idx = typeof index === 'number' ? index : parseInt(String(index), 10);
    if (!Number.isInteger(idx) || idx < 0 || idx >= session.collectedChests.length) {
      sendUIStateUpdate(player);
      return;
    }
    const chest = session.collectedChests[idx];
    if (!chest) { sendUIStateUpdate(player); return; }
    const chestTier = chest.tier as ChestTier;
    session.collectedChests.splice(idx, 1);

    const playerData = PlayerManager.loadPlayerData(player);
    const results = openChest(chestTier, playerData);
    applyChestRewards(playerData, results);
    PlayerManager.savePlayerData(player, {
      ownedAxes: playerData.ownedAxes,
      shards: playerData.shards,
      stats: playerData.stats,
    });

    const uiResults = results.map(result => {
      if (result.kind === 'axe') {
        const axe = AXES[result.axeId];
        return { kind: 'axe', axeId: result.axeId, axeName: axe.name, rarity: result.rarity };
      } else {
        const axe = AXES[result.sourceAxeId];
        return { kind: 'shards', amount: result.amount, axeName: axe.name, rarity: result.rarity };
      }
    });
    player.ui.sendData({ type: 'lootResults', results: uiResults });
    sendUIStateUpdate(player);
  }

  function handleLockedAxeClick(player: any, axeId: string) {
    const axe = AXES[axeId as AxeId];
    if (!axe) return;
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

  function handleEquipAxe(player: any, axeId: string) {
    const playerData = PlayerManager.loadPlayerData(player);
    if (!AXES[axeId as AxeId]) {
      world.chatManager.sendPlayerMessage(player, `Unknown axe: ${axeId}`, 'FF6B6B');
      return;
    }
    if (!playerData.ownedAxes[axeId as AxeId]) {
      world.chatManager.sendPlayerMessage(player, `You don't own that axe!`, 'FF6B6B');
      return;
    }
    if (playerData.equippedAxe === axeId) return;
    const playerEntity = world.entityManager.getPlayerEntitiesByPlayer(player)[0];
    if (playerEntity) {
      PlayerManager.equipAxe(player, playerEntity, world, axeId as AxeId);
      world.chatManager.sendPlayerMessage(player, `Equipped: ${AXES[axeId as AxeId].name}`, '00FF00');
      sendUIStateUpdate(player);
    }
  }

  // ── World events ───────────────────────────────────────────────────────────

  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    console.log(`[CutTrees] Player joined: ${player.username}`);
    const playerId = player.id ?? player.username;
    lobbyPlayers.add(playerId);

    // Spawn at lobby facing the teleport pad
    const playerEntity = new DefaultPlayerEntity({ player, name: player.username });
    playerEntity.spawn(world, LOBBY_SPAWN, LOBBY_SPAWN_ROTATION);
    player.camera.lookAtPosition({ x: 0, y: LOBBY_SPAWN.y, z: PAD_Z_CENTER });

    // Load UI (starts in lobby mode — PLAY button visible, HUD hidden)
    player.ui.load('ui/index.html');

    // Listen for UI messages (works for both lobby and game states)
    player.ui.on(PlayerUIEvent.DATA, ({ data }: any) => {
      if (data?.type === 'play') {
        // PLAY button clicked — teleport to arena
        sendPlayerToArena(player);
      }
      if (data?.type === 'openChest') handleOpenChest(player, data.index);
      if (data?.type === 'requestChop') {
        const chopped = choppingSystem.autoChop(player);
        if (chopped) sendUIStateUpdate(player);
      }
      if (data?.type === 'equipAxe') handleEquipAxe(player, data.axeId);
      if (data?.type === 'lockedAxeClick') handleLockedAxeClick(player, data.axeId);
    });

    world.chatManager.sendPlayerMessage(player, 'Welcome! Step on the glowing pad or click PLAY to start.', '00FF00');
  });

  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    console.log(`[CutTrees] Player left: ${player.username}`);
    const playerId = player.id ?? player.username;
    lobbyPlayers.delete(playerId);
    PlayerManager.clearSession(player);
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach((e: any) => e.despawn());
  });

  world.on(PlayerEvent.RECONNECTED_WORLD, ({ player }) => {
    player.ui.load('ui/index.html');
    const playerId = player.id ?? player.username;
    if (!lobbyPlayers.has(playerId)) {
      // Player was in the game — re-send game mode + state
      setTimeout(() => {
        player.ui.sendData({ type: 'enterGame' });
        sendUIStateUpdate(player, true);
      }, 500);
    }
  });

  // ── Chat commands ──────────────────────────────────────────────────────────

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

  world.chatManager.registerCommand('/power', (player, args) => {
    const argStr = Array.isArray(args) ? args[0] : args;
    const amount = parseInt(argStr, 10) || 1000;
    const newPower = PlayerManager.awardPower(player, amount);
    world.chatManager.sendPlayerMessage(player, `Power: ${newPower.toLocaleString()} (+${amount})`, '00FF00');
  });

  world.chatManager.registerCommand('/rocket', player => {
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach((entity: any) => {
      entity.applyImpulse({ x: 0, y: 20, z: 0 });
    });
  });

  // Debug: return to lobby
  world.chatManager.registerCommand('/lobby', player => {
    const playerId = player.id ?? player.username;
    if (lobbyPlayers.has(playerId)) {
      world.chatManager.sendPlayerMessage(player, 'You are already in the lobby.', 'FF6B6B');
      return;
    }
    // Despawn game entity, re-spawn at lobby
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach((e: any) => e.despawn());
    PlayerManager.clearSession(player);
    lobbyPlayers.add(playerId);
    const pe = new DefaultPlayerEntity({ player, name: player.username });
    pe.spawn(world, LOBBY_SPAWN, LOBBY_SPAWN_ROTATION);
    player.camera.setAttachedToEntity(pe);
    player.camera.lookAtPosition({ x: 0, y: LOBBY_SPAWN.y, z: PAD_Z_CENTER });
    player.ui.sendData({ type: 'enterLobby' });
    world.chatManager.sendPlayerMessage(player, 'Returned to lobby.', '00FF00');
  });

  // Ambient music
  new Audio({
    uri: 'audio/music/hytopia-main-theme.mp3',
    loop: true,
    volume: 0.1,
  }).play(world);

  console.log('[CutTrees] Server ready!');
});
