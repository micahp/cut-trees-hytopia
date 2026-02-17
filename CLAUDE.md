# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cut Trees is a multiplayer tree-chopping progression game built with the **HYTOPIA SDK** (`hytopia` npm package). Players chop trees, gain Cutting Power, unlock chests, and collect increasingly rare axes. All player progress persists across sessions via the HYTOPIA persistence API.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (hot-reload)
bun --watch index.ts

# Build for production
npm run build
```

**Connecting from hytopia.com/play:** If the browser blocks with "Permission was denied for this request to access the loopback address space" (Private Network Access / CORS), use a tunnel: run the server with `NODE_ENV=production bun --watch index.ts`, then `cloudflared tunnel --url http://localhost:8080`, and connect to the tunnel URL in the play client. See `docs/local-connection-and-cors.md`. Otherwise, add `127.0.0.1 local.hytopiahosting.com` to `/etc/hosts` and connect to `https://local.hytopiahosting.com:8080` (SDK dev cert matches this hostname, not localhost). Chromium browser required.

## Architecture

The codebase separates **pure game configuration** (data/constants) from **runtime systems** (stateful managers).

### Entry Point

`index.ts` — Initializes the HYTOPIA server, wires up all systems, handles player join/leave/reconnect events, UI event dispatch, and chat commands. This is the orchestration layer; game logic lives in the systems.

### Game Configuration (`src/game/`)

Pure data modules with no side effects. Barrel-exported via `src/game/index.ts`.

- **`rarity.ts`** — Rarity type (`"common"` | `"rare"` | `"epic"` | `"mythic"` | `"exotic"`), ordering, color codes, comparison helpers
- **`axes.ts`** — 8 axe definitions: damage, cooldown, AoE radius, perks (e.g., Emerald's extra roll chance)
- **`trees.ts`** — Tree types/tiers with HP, power rewards, respawn times; debris definitions; world multipliers (Forest 1x, Lava 10x HP / 3x power)
- **`chests.ts`** — 4 chest tiers with drop tables (rarity → percentage), unlock costs (nearby trees + power gates), respawn times, spawn weights
- **`loot.ts`** — Chest opening logic: weighted rarity rolls, axe pool resolution, duplicate → shard conversion, Emerald perk handling. `openChest()` returns results, `applyChestRewards()` mutates player data
- **`playerData.ts`** — `PlayerData` (persisted: power, shards, ownedAxes, equippedAxe, stats) and `PlayerSessionData` (per-run: collectedChests, nearbyTreesChopped, lastSwingTime)
- **`worldGeneration.ts`** — Procedural placement of ~200-250 trees and ~40 chests using outer-ring, interior-grove, and density-balanced patterns. Biome detection from map blocks

### Runtime Systems (`src/systems/`)

Stateful classes managing the game world. Barrel-exported via `src/systems/index.ts`.

- **`WorldLoopTimerManager`** (`timers.ts`) — Tick-aligned setTimeout/setInterval that syncs with the HYTOPIA world loop. Used for tree/chest respawns instead of JS timers
- **`PlayerManager`** (`playerManager.ts`) — Static methods for player data persistence (`loadPlayerData`, `savePlayerData`), session tracking, axe equipping with 3-phase swing animation, awarding power/shards/axes
- **`TreeManager`** (`treeManager.ts`) — Tree spawning, AoE damage, debris lifecycle (spawn → fade → despawn), respawn scheduling, callback on chop
- **`ChestManager`** (`chestManager.ts`) — Chest spawning, proximity-based unlock checking (nearby trees chopped + power gates), collection with inventory cap (20/run), respawn scheduling
- **`ChoppingSystem`** (`choppingSystem.ts`) — Player input (left-click) handling, raycast hit detection, AoE damage application, cooldown enforcement, auto-chop support

### UI (`src/ui/index.html`)

Single-file vanilla JS client. Communicates with the server via `hytopia.ui.sendData()` / `hytopia.ui.onData()`. Components: HUD (power/shards/axe), chest inventory panel, axe tabs by rarity, loot result display.

### Data Flow

1. Player left-clicks → `ChoppingSystem` raycasts → finds trees in AoE radius
2. `TreeManager.damageTree()` reduces HP → on death, awards power via `PlayerManager`, fires `onTreeChopped` callback
3. `ChestManager.trackTreeChop()` increments nearby-trees-chopped per spawn point
4. Player walks near chest → `ChestManager` checks unlock requirements → adds to session inventory
5. Player opens chest via UI → `index.ts` calls `openChest()` + `applyChestRewards()` → single atomic `savePlayerData()` call

## Key Patterns

- **Atomic saves**: Chest opening mutates the in-memory `PlayerData` object, then persists all changed fields in a single `savePlayerData()` call to avoid race conditions
- **Data integrity on join**: `index.ts` checks that `equippedAxe` exists in `ownedAxes` and auto-fixes if desynced
- **Barrel exports**: Import from `'./src/game'` or `'./src/systems'`, not individual files
- **Types as string literals**: `AxeId`, `TreeId`, `ChestTier` are string-literal union types for compile-time safety

## Game Balance Tuning

All balance values live in `src/game/`. Key constants:
- Chest spawn points per world: 40
- Nearby trees radius for chest unlocks: 22m
- Chest inventory cap per session: 20
- Chest interaction radius: 3.5m
