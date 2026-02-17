# UI icon choices (assets/icons)

Icons chosen to make the UI look like a real game instead of emoji/placeholder. All paths are relative to `assets/icons/`.

## HUD

| Element | Use | Path |
|--------|-----|------|
| **Power** | Lightning = strength/cutting power | `Main/Lighting/64px/Lighting 1st 64px.png` |
| **Shards** | Blue crystal = currency/shard | `currency/Crystal/64w/Crystal Blue 64px.png` |
| **Axe** | Generic axe for wooden/stone/iron/golden/diamond; specific PNG for gem axes | Generic: `Item/Axe/64px/Axe 1st 64px.png`. Ruby: `axes/png/ruby.png`, Sapphire: `axes/png/sapphire.png`, Emerald: `axes/png/emerald.png` |

## Buttons

| Element | Use | Path |
|--------|-----|------|
| **Inventory (backpack)** | Backpack | `Item/Backpack/64px/Backpack 1st 64px.png` |
| **Chests** | Chest | `Item/Chest/64px/Chest 1st 64px.png` |
| **Auto Chop** | Axe | `Item/Axe/64px/Axe 1st 64px.png` |

## Chest tiers (collected chests grid + loot)

| Tier | Use | Path |
|------|-----|------|
| common | Box | `Item/Box/64px/Box 1st 64px.png` |
| rare | Gift | `Item/Gift/64px/Red Gift 1st 64px.png` |
| epic | Chest | `Item/Chest/64px/Chest 1st 64px.png` |
| mythic | Crown | `Item/Crown/64px/Crown 1st 64px.png` |

## Loot modal

| Item type | Use | Path |
|-----------|-----|------|
| New axe | Same as HUD axe (generic or ruby/sapphire/emerald PNG) | As above |
| Shards | Crystal | `currency/Crystal/64w/Crystal Blue 64px.png` |

## Already in use

- **Mobile interact** – `icons/target.png` (root)
- **Mobile jump** – `icons/jump.png` (root)

## Optional later

- **Close panel** – `UI/Close Button/64px/Close Button 1st 64px.png` (currently ×)
- **Locked axe** – `Item/Lock/` variant
- **Checkmark / success** – `UI/Checkmark/` for loot or confirmations

## Sizing

- HUD and buttons: 24–32px height
- Chest slots: 32–40px
- Loot items: 32–40px
- Use CSS `object-fit: contain` and fixed width/height so icons don’t stretch.
