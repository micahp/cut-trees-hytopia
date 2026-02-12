/**
 * Lobby platform builder and game-area routing.
 *
 * Single-world architecture:
 *   - Lobby is an elevated platform at y=50 (box-seats above the arenas).
 *   - Arena areas are at ground level (y=0), offset along the X axis.
 *   - Player spawns at one end of the lobby runway and walks to the
 *     teleport pad at the other end (or clicks PLAY in the UI).
 */

type World = any;
type Vec3 = { x: number; y: number; z: number };

// ── Block type IDs (must match arena-map.json / lobby-map.json) ──────────
const BLOCK_GRASS = 7;
const BLOCK_WALL = 17;
/** Glowing pad block — registered with lightLevel 15 */
const BLOCK_PAD = 18;

// ── Arena area constants ──────────────────────────────────────────────────
/** Arena map X extent: from arena-map.json blocks are -15..15 → width 31 */
export const ARENA_MAP_WIDTH_X = 31;

/** Gap between areas (blocks to the right of previous area) */
export const ARENA_MAP_GAP = 50;

/** Stride per area: width + gap. Offset for area N = N * AREA_STRIDE */
export const AREA_STRIDE = ARENA_MAP_WIDTH_X + ARENA_MAP_GAP;

// ── Lobby geometry ────────────────────────────────────────────────────────
/** Lobby platform Y level (floor) */
const LOBBY_Y = 50;

/** Lobby runway dimensions (x: half-width, z: half-length) */
const LOBBY_HALF_W = 5;   // 11 blocks wide (-5 to +5)
const LOBBY_HALF_L = 14;  // 29 blocks long (-14 to +14)

/** Teleport pad: 5×5 at the +Z end of the runway */
const PAD_HALF = 2;       // -2 to +2
const PAD_Z_CENTER = 12;  // centre of pad in Z

/** Player spawn: -Z end of the runway, 5 above floor */
export const LOBBY_SPAWN: Vec3 = { x: 0, y: LOBBY_Y + 5, z: -(LOBBY_HALF_L - 1) };

/** Teleport pad AABB (player entity centre must be inside) */
export const LOBBY_PAD = {
  minX: -PAD_HALF - 0.5,
  maxX: PAD_HALF + 0.5,
  minY: LOBBY_Y + 0.5,
  maxY: LOBBY_Y + 4,
  minZ: PAD_Z_CENTER - PAD_HALF - 0.5,
  maxZ: PAD_Z_CENTER + PAD_HALF + 0.5,
};

// ── Helpers ───────────────────────────────────────────────────────────────

export function isOnLobbyPad(position: Vec3): boolean {
  return (
    position.x >= LOBBY_PAD.minX && position.x <= LOBBY_PAD.maxX &&
    position.y >= LOBBY_PAD.minY && position.y <= LOBBY_PAD.maxY &&
    position.z >= LOBBY_PAD.minZ && position.z <= LOBBY_PAD.maxZ
  );
}

/**
 * Build the lobby platform in the world at y=50.
 *
 * Layout (top-down, +Z is "forward" toward the pad):
 *   - 11×29 grass floor
 *   - 2-high mossy-cobblestone walls on the edges
 *   - 5×5 glowing pad at the +Z end
 *   - Open interior edges (gaps) so players can look down at arenas
 */
export function buildLobbyPlatform(world: World): void {
  // Register the glowing pad block type if not already present
  try {
    world.blockTypeRegistry.registerGenericBlockType({
      id: BLOCK_PAD,
      name: 'lobby-pad',
      textureUri: 'blocks/mossy-cobblestone.png',
      lightLevel: 15,
    });
  } catch {
    // Already registered from the arena map load — that's fine
  }

  const y = LOBBY_Y;

  // Floor
  for (let x = -LOBBY_HALF_W; x <= LOBBY_HALF_W; x++) {
    for (let z = -LOBBY_HALF_L; z <= LOBBY_HALF_L; z++) {
      world.chunkLattice.setBlock({ x, y, z }, BLOCK_GRASS);
    }
  }

  // Walls (2-high on the long edges)
  for (let z = -LOBBY_HALF_L; z <= LOBBY_HALF_L; z++) {
    for (let dy = 1; dy <= 2; dy++) {
      world.chunkLattice.setBlock({ x: -LOBBY_HALF_W, y: y + dy, z }, BLOCK_WALL);
      world.chunkLattice.setBlock({ x: LOBBY_HALF_W, y: y + dy, z }, BLOCK_WALL);
    }
  }

  // Walls on the short edges (spawn end only; pad end left open for aesthetics)
  for (let x = -LOBBY_HALF_W; x <= LOBBY_HALF_W; x++) {
    for (let dy = 1; dy <= 2; dy++) {
      world.chunkLattice.setBlock({ x, y: y + dy, z: -LOBBY_HALF_L }, BLOCK_WALL);
    }
  }

  // Teleport pad (glowing blocks replace floor)
  for (let x = -PAD_HALF; x <= PAD_HALF; x++) {
    for (let z = PAD_Z_CENTER - PAD_HALF; z <= PAD_Z_CENTER + PAD_HALF; z++) {
      world.chunkLattice.setBlock({ x, y, z }, BLOCK_PAD);
    }
  }

  console.log(`[Lobby] Built lobby platform at y=${y} (${2 * LOBBY_HALF_W + 1}×${2 * LOBBY_HALF_L + 1}), pad at z=${PAD_Z_CENTER}`);
}

/**
 * Add arena map blocks to the world at the given X offset.
 * Block types must already be registered (e.g. from an initial loadMap).
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
 * Compute spawn position (entity centre) for a given area index.
 * Area 0 centre at (0, 10, 0), area N at (N * AREA_STRIDE, 10, 0).
 */
export function getAreaSpawnPosition(areaIndex: number): Vec3 {
  return {
    x: areaIndex * AREA_STRIDE,
    y: 10,
    z: 0,
  };
}
