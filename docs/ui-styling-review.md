# UI Styling Review vs. Roblox Cut Trees Reference

Comparison of `src/ui/index.html` styling against the reference Roblox Cut Trees screenshots (in-game and lobby views).

---

## 1. Current Styling Strengths (Aligned With Reference)

| Aspect | Your Implementation | Reference (Roblox) |
|--------|---------------------|--------------------|
| **Bold typography** | `font-weight: 600–700`, sans-serif | Bold sans-serif labels |
| **High-contrast text** | `text-shadow: 0 1px 2px rgba(0,0,0,0.8)` on body | Thick outlines for readability |
| **Colored stat values** | Power (green `#b8ff2e`), Shards (blue `#4dd0ff`), Axe (orange `#ff7043`) | Green currency, colored stats |
| **Rarity colors** | Consistent palette (common → exotic) | Same color-coding approach |
| **Rounded buttons** | `border-radius: 14px` on action buttons | Rounded rectangular buttons |
| **Glow on highlights** | `text-shadow: 0 0 8px rgba(...)` on values; `box-shadow` on equipped | Glow on important elements |
| **Backdrop blur** | `backdrop-filter: blur(6px)` on HUD stats | Glass-style overlays |

---

## 2. Differences (Intentional or Room for Improvement)

### Layout

- **Reference:** Shards large and centered at top; action buttons and chest stack on left; main stats at bottom center.
- **Current:** HUD bottom-left; Chests, Auto Chop, Inventory stacked on right.
- **Implication:** Layout is different, but the current one works well and keeps things clear.

### Button Color Language

- **Reference:** Red used for "Auto Attack" and "End Run."
- **Current:** Dark panels with white borders (`rgba(255,255,255,0.9)`); gold accent on Chests hover, blue on Inventory hover.
- **Implication:** Reference leans into red for primary actions; current uses a more neutral scheme with accent on hover. For consistency with the reference, a stronger red for action buttons could be an option.

### Currency Emphasis

- **Reference:** Currency/shard count very prominent (large, top-center, strong outline).
- **Current:** Shards live in the HUD stat row at bottom-left.
- **Implication:** If shards are the main economy, they could be made more prominent (larger size, dedicated position, or top placement).

### Progress Bar

- **Reference:** Horizontal bar with "2,270/2,500" for level progress.
- **Current:** No explicit level/progress bar in the UI.
- **Implication:** Adding a similar bar for Cutting Power / level would align with the reference and make progression clearer.

### Chest Inventory Layout

- **Reference:** Vertical stack of chests by tier with "LEVEL 6", "LEVEL 5", and counts.
- **Current:** Grid in a modal, with `.chest-slot` and `.tier` labels.
- **Implication:** Current approach is fine and arguably more scalable; reference's vertical stack is more compact for always-on use.

---

## 3. Styling Decisions That Work Well

- **Pill stats** (`border-radius: 999px`) create a distinct, clean look.
- **White borders** (`border: 2px solid rgba(255,255,255,0.85)`) give strong contrast on dark backgrounds, similar in spirit to the reference's outlined text.
- **Rarity-driven borders** on chest slots and axe cards (`.chest-slot.common`, `.axe-card.rarity-epic`, etc.) are clear and consistent.
- **Gradient panels** (`linear-gradient(145deg, ...)`) add depth without being too busy.
- **Icons from CDN** instead of emojis support a more cohesive, game-like feel.

---

## 4. Minor Suggestions vs. Reference (Implemented)

1. ✅ **Primary currency / shards:** Top-center `.shards-display` with large (32px) shard count and thick black outline. Visible in lobby and game.
2. ✅ **Action buttons:** Auto Chop and Chests use red gradient (`#e53935`–`#c62828`).
3. ✅ **Progress feedback:** Power progress bar at bottom-center with level, current/next threshold, and green fill (e.g. "2,270/2,500").
4. **Auto Chop active state:** Reference uses a distinct "(ON)" treatment; `.auto-chop-button.active` with green glow already conveys this well.

---

## Summary

The current UI is consistent and polished, with strong typography, contrast, and visual hierarchy. It diverges from the reference mainly in layout and color semantics rather than in overall style quality. If the goal is visual parity with the Roblox reference, the main levers are: shards placement/size, stronger red for primary actions, and a level/progress bar. If the goal is a distinct but compatible look, the current styling is already in good shape.
