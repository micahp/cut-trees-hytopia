# Hytopia Environment & Map Building

## How Hytopia games build environments

- **Maps are data-driven.** The world is defined by a `WorldMap` object (usually from `map.json`) with:
  - **`blockTypes`**: Array of block type definitions (`id`, `name`, `textureUri`, `isCustom`, `isMultiTexture`, `isLiquid`).
  - **`blocks`**: Object mapping `"x,y,z"` (world block coordinates) to a block type **id** (number) or `{ i: number, r?: number }` for rotation.
  - **`entities`**: Optional object mapping `"x,y,z"` positions to entity options (models, props, etc.).

- **Loading:** The server calls `world.loadMap(map)`. This:
  1. Clears the chunk lattice.
  2. Registers every entry in `map.blockTypes` with `world.blockTypeRegistry`.
  3. Fills the world from `map.blocks` via `chunkLattice.initializeBlockEntries`.
  4. Spawns `map.entities` as environmental entities.

- **Block types:** There is no fixed “default” set; textures come from your `assets/blocks` (or shared Hytopia assets). Register block types that reference texture URIs under `blocks/` (e.g. `blocks/stone.png`, `blocks/grass-block` for multi-texture).

- **Walls vs props:**
  - **Walls / terrain:** Use **blocks** (voxel grid) with block textures (e.g. `blocks/mossy-cobblestone.png`).
  - **Props (e.g. mossy boulder):** Use **entities** with a model URI (e.g. `models/environment/Pine Forest/mossy-boulder.gltf`) if that asset exists in your project.

## Mossy boulder in default assets

- **As a block (walls):** There is no “mossy boulder” block type in the SDK. For a mossy wall look we use block **textures** such as:
  - `blocks/mossy-cobblestone.png`
  - `blocks/mossy-stone-bricks.png`
  (Check `assets/blocks/.atlas/atlas.json` or your asset pack for exact names.)

- **As a 3D prop:** The shared Hytopia assets can include a **mossy-boulder** environment **model** (e.g. `models/environment/Pine Forest/mossy-boulder.gltf`). That is for decorative placement as an entity, not for voxel walls.

## Map format reference

- **Block type (in `blockTypes`):**
  - `id`: number (unique per map, 1–255).
  - `name`: string.
  - `textureUri`: string (e.g. `"blocks/stone.png"` or `"blocks/grass-block"` for multi-face).
  - `isCustom`, `isMultiTexture`, `isLiquid`: optional booleans.

- **Block placement (in `blocks`):**
  - Key: `"x,y,z"` (integer coordinates).
  - Value: block type `id` (number) or `{ i: id, r?: rotationIndex }`.

- **Coordinates:** World block grid; origin (0,0,0) is valid. Y is up.

## This project

- **Current map:** `assets/map.json` (large default map).
- **Custom map with walls:** A separate map (e.g. `assets/arena-map.json`) can define a small floor (e.g. grass-block, id 7) and perimeter walls (e.g. mossy-cobblestone, id 17) so the game has a bounded arena while still using the same spawn/tree/chest logic (which expects grass block id 7 for spawnable ground).
