/**
 * Rarity system for axes and chest drops.
 * Based on Cut Trees v1 tuning sheet.
 */

export type Rarity = "common" | "rare" | "epic" | "mythic" | "exotic";

export const RARITY_ORDER: readonly Rarity[] = [
  "common",
  "rare",
  "epic",
  "mythic",
  "exotic",
] as const;

/** Display colors for each rarity (hex) */
export const RARITY_COLORS: Record<Rarity, string> = {
  common: "#9d9d9d",   // Gray
  rare: "#4fc3f7",     // Blue
  epic: "#ba68c8",     // Purple
  mythic: "#ffd54f",   // Gold
  exotic: "#ff5252",   // Red
};

/** Display names for UI */
export const RARITY_DISPLAY_NAMES: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  mythic: "Mythic",
  exotic: "Exotic",
};

export function nextRarityUp(r: Rarity): Rarity {
  const i = RARITY_ORDER.indexOf(r);
  return RARITY_ORDER[Math.min(i + 1, RARITY_ORDER.length - 1)];
}

export function rarityIndex(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

export function isRarityAtLeast(r: Rarity, threshold: Rarity): boolean {
  return rarityIndex(r) >= rarityIndex(threshold);
}
