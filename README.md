# Cut Trees - HYTOPIA Game

A tree-chopping progression game built with the HYTOPIA SDK. Players chop trees to gain power, unlock chests, and collect increasingly rare axes.

## Game Loop

1. **Chop trees** with your equipped axe (left-click)
2. **Gain Cutting Power** from each tree you chop
3. **Unlock chests** by chopping enough nearby trees
4. **Collect axes** from chests (with rarity-based drops)
5. **Progress** to better axes with higher damage and larger AoE

## Features

- **8 Axes** across 5 rarities (Common → Exotic)
- **10 Tree types** across 5 tiers with scaling HP/rewards
- **4 Chest tiers** with unlock requirements and power gates
- **AoE chopping** - better axes hit more trees per swing
- **Persistent progression** - data saves across sessions
- **Duplicate protection** - extra axes convert to Shards currency
- **Emerald Axe perk** - 20% chance for bonus chest roll

## Axe Stats (v1 Tuning)

| Axe | Rarity | Damage | Cooldown | Area |
|-----|--------|--------|----------|------|
| Wooden | Common | 12 | 0.90s | 1.7m |
| Stone | Rare | 20 | 0.85s | 2.0m |
| Iron | Epic | 35 | 0.80s | 2.6m |
| Golden | Epic | 28 | 0.60s | 3.0m |
| Diamond | Mythic | 55 | 0.65s | 3.3m |
| Ruby | Exotic | 80 | 0.70s | 3.3m |
| Sapphire | Exotic | 60 | 0.70s | 4.2m |
| Emerald | Exotic | 60 | 0.65s | 3.3m |

## Chest Unlock Requirements

| Chest | Trees Needed | Power Gate | Respawn |
|-------|-------------|------------|---------|
| Common | 8 | - | 2.5 min |
| Rare | 18 | - | 2.5 min |
| Epic | 30 | 2,000 | 6 min |
| Mythic | 45 | 10,000 | 12.5 min |

## Chat Commands

| Command | Description |
|---------|-------------|
| `/stats` | View your power, shards, and stats |
| `/equip <axe>` | Equip an owned axe |
| `/give <axe>` | (Debug) Grant an axe |
| `/power <amount>` | (Debug) Add cutting power |
| `/rocket` | Launch yourself into the air |

## Project Structure

```
├── index.ts                 # Main entry point
├── src/
│   ├── game/                # Game configuration (pure data)
│   │   ├── rarity.ts        # Rarity types and helpers
│   │   ├── axes.ts          # Axe definitions and stats
│   │   ├── trees.ts         # Tree definitions and tiers
│   │   ├── chests.ts        # Chest definitions and drop tables
│   │   ├── playerData.ts    # Player data structure
│   │   ├── loot.ts          # Chest opening and shard logic
│   │   └── index.ts         # Barrel export
│   └── systems/             # Server runtime systems
│       ├── timers.ts        # Tick-aligned timer manager
│       ├── playerManager.ts # Persistence and session tracking
│       ├── treeManager.ts   # Tree spawning and damage
│       ├── chestManager.ts  # Chest spawning and unlocking
│       ├── choppingSystem.ts# Input handling and AoE damage
│       └── index.ts         # Barrel export
└── assets/
    └── models/
        ├── axes/            # Axe models (.gltf)
        ├── chests/          # Chest models (.gltf)
        └── environment/     # Tree models (.gltf)
```

## Development

### Prerequisites

- [Bun](https://bun.sh/) runtime
- HYTOPIA SDK (`npm install hytopia`)

### Run Development Server

```bash
bun --watch index.ts
```

### Connect to Game

1. Go to https://hytopia.com/play
2. Enter `https://localhost:8080`
3. Use Chrome, Brave, or Edge (Chromium required)

### Build for Production

```bash
npm run build
```

## Configuration

All game balance values are in `src/game/`:

- **Axes**: `axes.ts` - damage, cooldown, area radius
- **Trees**: `trees.ts` - HP, power rewards, respawn times
- **Chests**: `chests.ts` - unlock costs, power gates, drop tables
- **Loot**: `loot.ts` - duplicate shard values, upgrade costs

## Tuning Reference

Based on [Cut Trees](https://cuttrees.org/) mechanics:
- Chest spawn points: 40 per world
- Nearby trees radius: 22 meters
- Inventory cap: 20 chests per run
- World multipliers: Forest (1x), Lava (10x HP, 3x power)

## License

ISC
