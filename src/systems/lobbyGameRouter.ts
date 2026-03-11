/**
 * Lobby platform builder and game-area routing.
 *
 * Single-world architecture:
 *   - Lobby is an elevated "arena box seats" at y=50, directly above the arena.
 *   - Players spawn on the main floor, walk to the glass observation deck,
 *     and step on the glowing teleport pad to drop into the arena 50 blocks below.
 *   - Arena areas are at ground level (y=0), offset along the X axis.
 *
 * Box Seats Layout (z-axis, top-down, +Z = toward the glass/arena):
 *
 *   z=-12  [BACK WALL — stone bricks, 5 high]
 *   z=-11  ┐
 *   z=-10  ┘  Tier 3 deepslate seating  (surface y+3)
 *   z= -9  ┐
 *   z= -8  ┘  Tier 2 deepslate seating  (surface y+2)
 *   z= -7  ┐
 *   z= -6  ┘  Tier 1 deepslate seating  (surface y+1)
 *   z= -5  ┐
 *          │  Main stone-brick floor  ← PLAYER SPAWNS at z=-3
 *   z=  3  ┘
 *   z=  4     Gold transition strip
 *   z=  5  ┐
 *          │  Glass observation deck  (see-through to arena at y=0)
 *          │  5×5 glowing teleport pad centred at z=10  ← TELEPORT HERE
 *   z= 12  ┘  Front glass railing (2 high)
 *
 * Side walls: stone bricks z=-12..4  |  glass z=5..11
 * Iron pillars at corners + midpoints; gold accent caps + cornice.
 */

type World = any;
type Vec3 = { x: number; y: number; z: number };

// ── Block type IDs ────────────────────────────────────────────────────────────
const BLOCK_PAD          = 18;  // glowing teleport pad (lightLevel 15)
const BLOCK_STONE_BRICKS = 19;  // lobby floor / walls
const BLOCK_GLASS        = 20;  // glass observation deck + side walls
const BLOCK_IRON         = 21;  // pillars
const BLOCK_GOLD         = 22;  // accent trim
const BLOCK_DEEPSLATE    = 23;  // tiered seating

// ── Arena area constants ──────────────────────────────────────────────────────
/** Arena map X extent: blocks are -15..15 → width 31 */
export const ARENA_MAP_WIDTH_X = 31;
/** Gap between arena areas */
export const ARENA_MAP_GAP = 50;
/** Stride per area: offset for area N = N * AREA_STRIDE */
export const AREA_STRIDE = ARENA_MAP_WIDTH_X + ARENA_MAP_GAP;

// ── Lobby geometry ────────────────────────────────────────────────────────────
const LOBBY_Y      = 50;
const LOBBY_HALF_W = 12;  // 25 blocks wide  (x: -12..12)
const LOBBY_HALF_L = 12;  // 25 blocks long  (z: -12..12)

const PAD_HALF = 2;
export const PAD_Z_CENTER = 10;  // centre of the teleport pad in Z

/** Player spawns on the main stone floor, facing the glass deck and arena below. */
export const LOBBY_SPAWN: Vec3 = { x: 0, y: LOBBY_Y + 5, z: -3 };

/** Face +Z (toward pad / glass / arena) */
export const LOBBY_SPAWN_ROTATION = { x: 0, y: 1, z: 0, w: 0 };

/** Teleport pad AABB — player entity centre must be inside to trigger */
export const LOBBY_PAD = {
  minX: -PAD_HALF - 0.5,
  maxX:  PAD_HALF + 0.5,
  minY:  LOBBY_Y + 0.5,
  maxY:  LOBBY_Y + 4,
  minZ:  PAD_Z_CENTER - PAD_HALF - 0.5,
  maxZ:  PAD_Z_CENTER + PAD_HALF + 0.5,
};

export function isOnLobbyPad(position: Vec3): boolean {
  return (
    position.x >= LOBBY_PAD.minX && position.x <= LOBBY_PAD.maxX &&
    position.y >= LOBBY_PAD.minY && position.y <= LOBBY_PAD.maxY &&
    position.z >= LOBBY_PAD.minZ && position.z <= LOBBY_PAD.maxZ
  );
}

// ── Lobby builder ─────────────────────────────────────────────────────────────

/**
 * Build the Arena Box Seats lobby at y=50.
 *
 * The glass observation deck sits directly above the arena map (y=0), giving
 * players a bird's-eye view of the arena they're about to drop into.
 */
export function buildLobbyPlatform(world: World): void {
  // Register lobby-exclusive block types
  const defs: Array<{ id: number; name: string; textureUri: string; lightLevel?: number }> = [
    { id: BLOCK_PAD,          name: 'lobby-pad',         textureUri: 'blocks/mossy-cobblestone.png', lightLevel: 15 },
    { id: BLOCK_STONE_BRICKS, name: 'lobby-stone-bricks',textureUri: 'blocks/stone-bricks.png'   },
    { id: BLOCK_GLASS,        name: 'lobby-glass',        textureUri: 'blocks/glass.png'           },
    { id: BLOCK_IRON,         name: 'lobby-iron',         textureUri: 'blocks/iron-block.png'      },
    { id: BLOCK_GOLD,         name: 'lobby-gold',         textureUri: 'blocks/gold-block.png'      },
    { id: BLOCK_DEEPSLATE,    name: 'lobby-deepslate',    textureUri: 'blocks/deepslate.png'       },
  ];
  for (const def of defs) {
    try {
      world.blockTypeRegistry.registerGenericBlockType({
        id:         def.id,
        name:       def.name,
        textureUri: def.textureUri,
        ...(def.lightLevel !== undefined ? { lightLevel: def.lightLevel } : {}),
      });
    } catch { /* already registered on hot-reload */ }
  }

  const y = LOBBY_Y;
  const W = LOBBY_HALF_W;  // 12
  const L = LOBBY_HALF_L;  // 12

  // ── FLOOR ──────────────────────────────────────────────────────────────────

  // Stone-brick main floor: z=-12 to z=3
  for (let x = -W; x <= W; x++) {
    for (let z = -L; z <= 3; z++) {
      world.chunkLattice.setBlock({ x, y, z }, BLOCK_STONE_BRICKS);
    }
  }

  // Gold transition strip at z=4 (visual boundary between floor and glass)
  for (let x = -W; x <= W; x++) {
    world.chunkLattice.setBlock({ x, y, z: 4 }, BLOCK_GOLD);
  }

  // Glass observation deck: z=5 to z=12
  for (let x = -W; x <= W; x++) {
    for (let z = 5; z <= L; z++) {
      world.chunkLattice.setBlock({ x, y, z }, BLOCK_GLASS);
    }
  }

  // ── TELEPORT PAD (replaces glass at pad zone) ───────────────────────────────
  for (let x = -PAD_HALF; x <= PAD_HALF; x++) {
    for (let z = PAD_Z_CENTER - PAD_HALF; z <= PAD_Z_CENTER + PAD_HALF; z++) {
      world.chunkLattice.setBlock({ x, y, z }, BLOCK_PAD);
    }
  }

  // ── TIERED SEATING (deepslate) ─────────────────────────────────────────────
  // Each tier is solid from y+1 up to its surface, offset 1 from the side walls.
  const SX = W - 1;  // inner x extent for seating (x: -11..11)

  // Tier 1 — surface y+1, rows z=-7..-6
  for (let x = -SX; x <= SX; x++) {
    for (let z = -7; z <= -6; z++) {
      world.chunkLattice.setBlock({ x, y: y + 1, z }, BLOCK_DEEPSLATE);
    }
  }

  // Tier 2 — surface y+2, rows z=-9..-8
  for (let x = -SX; x <= SX; x++) {
    for (let z = -9; z <= -8; z++) {
      world.chunkLattice.setBlock({ x, y: y + 1, z }, BLOCK_DEEPSLATE);
      world.chunkLattice.setBlock({ x, y: y + 2, z }, BLOCK_DEEPSLATE);
    }
  }

  // Tier 3 — surface y+3, rows z=-11..-10
  for (let x = -SX; x <= SX; x++) {
    for (let z = -11; z <= -10; z++) {
      world.chunkLattice.setBlock({ x, y: y + 1, z }, BLOCK_DEEPSLATE);
      world.chunkLattice.setBlock({ x, y: y + 2, z }, BLOCK_DEEPSLATE);
      world.chunkLattice.setBlock({ x, y: y + 3, z }, BLOCK_DEEPSLATE);
    }
  }

  // ── BACK WALL (z=-12, stone bricks 5 high) ─────────────────────────────────
  for (let x = -W; x <= W; x++) {
    for (let dy = 1; dy <= 5; dy++) {
      world.chunkLattice.setBlock({ x, y: y + dy, z: -L }, BLOCK_STONE_BRICKS);
    }
  }

  // ── SIDE WALLS ─────────────────────────────────────────────────────────────
  // Stone bricks on the "indoor" section (z=-11..4), 4 high
  for (let z = -L + 1; z <= 4; z++) {
    for (let dy = 1; dy <= 4; dy++) {
      world.chunkLattice.setBlock({ x: -W, y: y + dy, z }, BLOCK_STONE_BRICKS);
      world.chunkLattice.setBlock({ x:  W, y: y + dy, z }, BLOCK_STONE_BRICKS);
    }
  }
  // Glass on the observation deck sides (z=5..11), 3 high — see the arena from the sides too
  for (let z = 5; z <= L - 1; z++) {
    for (let dy = 1; dy <= 3; dy++) {
      world.chunkLattice.setBlock({ x: -W, y: y + dy, z }, BLOCK_GLASS);
      world.chunkLattice.setBlock({ x:  W, y: y + dy, z }, BLOCK_GLASS);
    }
  }

  // ── FRONT GLASS RAILING (z=12, 2 high) ────────────────────────────────────
  for (let x = -W; x <= W; x++) {
    world.chunkLattice.setBlock({ x, y: y + 1, z: L }, BLOCK_GLASS);
    world.chunkLattice.setBlock({ x, y: y + 2, z: L }, BLOCK_GLASS);
  }

  // ── IRON PILLARS ──────────────────────────────────────────────────────────
  // Back corners, mid-wall, and front corners — iron column with gold cap
  const pillarXZ: Array<{ x: number; z: number; h: number }> = [
    { x: -W, z: -L, h: 6 },  // back-left corner
    { x:  W, z: -L, h: 6 },  // back-right corner
    { x: -W, z:  0, h: 5 },  // mid-left
    { x:  W, z:  0, h: 5 },  // mid-right
    { x: -W, z:  L, h: 3 },  // front-left corner (short — railing height)
    { x:  W, z:  L, h: 3 },  // front-right corner
  ];
  for (const { x, z, h } of pillarXZ) {
    for (let dy = 1; dy <= h; dy++) {
      world.chunkLattice.setBlock({ x, y: y + dy, z }, BLOCK_IRON);
    }
    world.chunkLattice.setBlock({ x, y: y + h + 1, z }, BLOCK_GOLD);  // gold cap
  }

  // ── GOLD ACCENT TRIM ──────────────────────────────────────────────────────
  // Cornice along the top of the back wall (y+5)
  for (let x = -W + 1; x <= W - 1; x++) {
    world.chunkLattice.setBlock({ x, y: y + 5, z: -L }, BLOCK_GOLD);
  }
  // Cornice along the top of the side walls (y+4) for the indoor section
  for (let z = -L + 1; z <= 4; z++) {
    world.chunkLattice.setBlock({ x: -W, y: y + 4, z }, BLOCK_GOLD);
    world.chunkLattice.setBlock({ x:  W, y: y + 4, z }, BLOCK_GOLD);
  }

  console.log(`[Lobby] Arena box-seats built at y=${y}. Glass deck z=5..12 overlooks arena at y=0.`);
}

// ── Arena helpers ─────────────────────────────────────────────────────────────

/**
 * Add arena map blocks to the world at the given X offset.
 * Block types must already be registered (e.g. from the initial loadMap).
 */
export function addArenaBlocksAtOffset(
  world: World,
  mapData: { blocks: Record<string, number | { i: number; r?: number }> },
  offsetX: number,
): void {
  const blocks = mapData.blocks;
  for (const key of Object.keys(blocks)) {
    const i1 = key.indexOf(',');
    const i2 = key.indexOf(',', i1 + 1);
    const x = Number(key.slice(0, i1));
    const y = Number(key.slice(i1 + 1, i2));
    const z = Number(key.slice(i2 + 1));
    const value = blocks[key];
    const blockTypeId = typeof value === 'number' ? value : value.i;
    if (!blockTypeId) continue;
    world.chunkLattice.setBlock({ x: x + offsetX, y, z }, blockTypeId);
  }
}

/**
 * Compute spawn position for a given arena area index.
 * Area 0 centre at (0, 10, 0), area N at (N * AREA_STRIDE, 10, 0).
 */
export function getAreaSpawnPosition(areaIndex: number): Vec3 {
  return {
    x: areaIndex * AREA_STRIDE,
    y: 10,
    z: 0,
  };
}
