# Cut Trees – Context Summary (2026-03-04)

Purpose: Context summary for the Arena Box Seats lobby redesign and UI overhaul session.

---

## 1. Session Goals

1. Redesign the lobby zone from a plain grass platform into a proper "Arena Box Seats" viewing area that overlooks the arena map from above.
2. Overhaul the UI to feel like a real game (AAA aesthetic) rather than a web app.

---

## 2. Arena Box Seats Lobby

### 2.1 Concept

**Problem:** The lobby was a plain 25×25 grass floor with mossy-cobblestone walls and a glowing pad — functional but felt like a placeholder, with no sense of place or relation to the arena map below it.

**Fix:** Redesigned `buildLobbyPlatform()` as a full stadium "box seats" experience. The lobby is at y=50, directly above the arena map at y=0. The front half of the platform is a glass floor that lets players look 50 blocks straight down into the arena they're about to enter — like a luxury skybox above a stadium. The back half is tiered deepslate seating facing the glass/arena view.

**File:** `src/systems/lobbyGameRouter.ts`

### 2.2 Block Palette (new block type IDs 19–23)

| ID | Name | Texture | Use |
|----|------|---------|-----|
| 18 | lobby-pad | `blocks/mossy-cobblestone.png` | Glowing teleport pad (lightLevel 15) — unchanged |
| 19 | lobby-stone-bricks | `blocks/stone-bricks.png` | Main floor + walls |
| 20 | lobby-glass | `blocks/glass.png` | Observation deck floor + side walls on deck section |
| 21 | lobby-iron | `blocks/iron-block.png` | Corner and midpoint pillars |
| 22 | lobby-gold | `blocks/gold-block.png` | Transition strip, back-wall cornice, side-wall trim, pillar caps |
| 23 | lobby-deepslate | `blocks/deepslate.png` | Tiered seating |

### 2.3 Layout (z-axis, +Z = toward the glass/arena)

```
z=-12  Back wall (stone bricks, 5 high)
z=-11  ┐
z=-10  ┘  Tier 3 deepslate seating  (surface at y+3)
z= -9  ┐
z= -8  ┘  Tier 2 deepslate seating  (surface at y+2)
z= -7  ┐
z= -6  ┘  Tier 1 deepslate seating  (surface at y+1)
z= -5  ┐
       │  Stone-brick main floor  ← PLAYER SPAWNS at z=-3
z=  3  ┘
z=  4     Gold transition strip
z=  5  ┐
       │  Glass observation deck  (see-through to arena at y=0, 50 blocks below)
       │  Teleport pad (5×5 glowing, x:-2..2, z:8..12) embedded in glass
z= 12  ┘  Front glass railing (2 high)
```

- Side walls: stone bricks for z=-11..4, glass for z=5..11 (so the arena is visible from the sides too)
- Iron pillars at 6 positions (corners + z=0 midpoints), each with a gold cap
- Gold cornice along back wall top (y+5) and side wall tops (y+4)

### 2.4 Spawn Position Updated

Changed `LOBBY_SPAWN.z` from -7 (old, put player in seating area) to -3 (main stone floor, open sightline to glass deck and arena below).

| Constant | Old | New | Notes |
|----------|-----|-----|-------|
| `LOBBY_SPAWN` z | -7 | -3 | Now on main floor, not on seating |
| Floor material | grass-block | stone-bricks | More premium look |
| Wall material | mossy-cobblestone | stone-bricks + glass | Stadium box feel |
| Seating | (none) | Deepslate 3-tier staircase | Faces the glass/arena |
| Observation deck | (none) | Glass floor z=5..12 | See-through to arena below |

---

## 3. UI Overhaul

### 3.1 Fonts

Added Google Fonts import: **Bebas Neue** for display text (lobby title, PLAY button), **Rajdhani** for game HUD and body text. Both are game-appropriate condensed typefaces vs the previous generic 'Inter'.

**File:** `src/ui/index.html`

### 3.2 Lobby Screen Redesign

**Problem:** The lobby UI was just a single green PLAY button floating at the bottom center — no branding, no context, no game feel.

**Fix:** Replaced the standalone button with a full `.lobby-screen` overlay component:
- Top+bottom gradient vignette (dark at edges, transparent in the center) so the 3D box seats world shows through
- **Game title:** "CUT TREES" in Bebas Neue, large (88px), with a green gradient fill and glow — highly readable over the 3D scene
- Decorative axe glyph row with flanking accent lines between title and tagline
- Tagline in small uppercase spaced lettering
- **PLAY button:** Redesigned from a green pill to a dark-background button with a green border/glow, Bebas Neue lettering, play arrow icon, and a pulsing glow animation
- Hint text below the button: "Step on the glowing pad · or click play"

### 3.3 HUD Redesign

**Problem:** The HUD used rounded pill shapes with white borders that looked like a web app, not a game.

**Fix:** Moved HUD from bottom-left to **top-left**. Replaced pills with compact dark rectangular panels that use a **colored left-border accent** (green=Power, blue=Shards, orange=Axe) as the primary visual signal. Labels are small uppercase/dimmed; values are large and glow-colored. No heavy border around the whole element.

### 3.4 Action Button Redesign

**Problem:** Inventory/Chests/Auto-Chop buttons used the same white-border pill style as the HUD.

**Fix:** Rebuilt with the same dark-panel + colored-left-border language as the HUD. Hover state slides the button slightly left (`translateX(-2px)`) instead of scaling — more game-like. Button positions consolidated (right side, stacked vertically).

---

## 4. Change Log

| Layer | Filepath | Change |
|-------|----------|--------|
| Systems | `src/systems/lobbyGameRouter.ts` | Full rebuild of `buildLobbyPlatform()`: 6 new block types, glass deck, tiered seating, iron pillars, gold trim, LOBBY_SPAWN.z → -3 |
| UI | `src/ui/index.html` | Add Google Fonts; lobby screen overlay with title+tagline+play button; HUD top-left dark panels; action button language overhaul |

---

## 5. Lobby Geometry Reference (current state)

| Constant | Value | Notes |
|----------|-------|-------|
| `LOBBY_Y` | 50 | Platform floor level |
| `LOBBY_HALF_W` | 12 | 25 blocks wide (x: -12..12) |
| `LOBBY_HALF_L` | 12 | 25 blocks long (z: -12..12) |
| `PAD_Z_CENTER` | 10 | Centre of 5×5 teleport pad |
| `LOBBY_SPAWN` | `{x:0, y:55, z:-3}` | Main floor area, 13 blocks from pad |
| `LOBBY_SPAWN_ROTATION` | `{x:0, y:1, z:0, w:0}` | 180° Y — player faces +Z toward glass/pad |
| Glass deck | z=5..12 | See-through floor above arena (y=0) |
| Teleport pad | x:-2..2, z:8..12 | Embedded in glass floor, 5×5 glowing |
| Pad AABB | y: 50.5..54, z: 7.5..12.5, x: -2.5..2.5 | Entity centre must be inside to trigger |

---

## 6. Outstanding Work

1. **Commit lobby + UI changes** — Pending.
2. **Fix lobby orientation (deferred from 2/18)** — P1 — Player entity still faces camera. Requires holistic layout pass: swap pad/spawn Z positions, update walls, AABB, camera. See 2/18 context §3.3.
3. **Playtest lobby** — P1 — Verify player falls cleanly to z=-3 floor; verify seating tiers are walkable; verify glass floor renders correctly; verify pad AABB triggers teleport.
4. **Item Shop** — P0 — Wire `shopItems.ts`, purchase handlers, and UI per `docs/economy-and-shops.md`. Now that the lobby has space and visual identity, this is the next major feature.
5. **Lobby feature build-out** — P2 — Leaderboard display, shop NPC, decorative props in the box seats area.
6. **Playtest and tune `SHARD_BASE_BY_TIER`** — P1 — Validate 2.5–4 hr target for first 10k shards (carried over from 2/17).

---

## 7. Decision Log

- **Decision:** Glass floor observation deck (looking down 50 blocks into the arena). **Rationale:** The lobby is already at y=50 above the arena. A glass floor gives players a dramatic preview of the arena they're teleporting into and creates an immediate "wow" moment vs a grass platform with no context. The sightline from spawn (z=-3) directly to the glass edge and glowing pad is the intended player path.
- **Decision:** Tiered deepslate seating facing the glass. **Rationale:** Sells the "stadium box seats" metaphor. Each row is one block higher than the one in front (standard stadium geometry), giving back-row players a sightline over front-row players. Future use: shop/leaderboard NPCs placed in this seating zone.
- **Decision:** Stone bricks + iron + gold palette instead of grass + mossy-cobblestone. **Rationale:** Grass says "outside world"; stone bricks say "built structure". Iron and gold are the universal Minecraft/Hytopia premium accent materials and match the esports/arena aesthetic.
- **Decision:** HUD moved to top-left. **Rationale:** Bottom-left puts the HUD over the player's feet and conflicts with the chop-reward popups. Top-left is the standard game convention (health bars, stats) and leaves the lower area clear for action.
- **Decision:** Lobby screen is a transparent overlay (not a full opaque menu). **Rationale:** The lobby world (box seats) is the hook — players should see it on first load. An opaque menu would hide the work done on the 3D space. Vignette gradients at top/bottom focus attention on the UI elements without hiding the world.
