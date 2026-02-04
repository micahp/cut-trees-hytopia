/**
 * Axe definitions with stats and roles.
 * Based on Cut Trees v1 tuning sheet.
 * 
 * Stats reference:
 * - Damage: HP removed per swing
 * - Cooldown: Seconds between swings
 * - Area: Radius in meters for AoE hits
 */

import type { Rarity } from "./rarity";

export type AxeId =
  | "wooden"
  | "stone"
  | "iron"
  | "golden"
  | "diamond"
  | "ruby"
  | "sapphire"
  | "emerald";

export type AxePerks = {
  /** Emerald perk: 20% chance for second roll on chest open */
  extraRollChance?: number;
};

export type AxeDef = {
  id: AxeId;
  name: string;
  rarity: Rarity;
  
  /** ModelEntity modelUri - points to assets folder */
  modelUri: string;
  
  /** HP removed per swing */
  damage: number;
  
  /** Seconds between swings */
  cooldown: number;
  
  /** AoE radius in meters - hits all trees within radius of hit point */
  areaRadius: number;
  
  /** Special perks (Emerald economy) */
  perks?: AxePerks;
};

/**
 * v1 Axe stat table
 * Target feel: early game favors Area over damage (so players learn "hit clusters")
 */
export const AXES: Record<AxeId, AxeDef> = {
  // Common
  wooden: {
    id: "wooden",
    name: "Wooden Axe",
    rarity: "common",
    modelUri: "models/tools/axe/wooden-axe.gltf",
    damage: 12,
    cooldown: 0.90,
    areaRadius: 1.7,
  },

  // Rare
  stone: {
    id: "stone",
    name: "Stone Axe",
    rarity: "rare",
    modelUri: "models/tools/axe/stone-axe.gltf",
    damage: 20,
    cooldown: 0.85,
    areaRadius: 2.0,
  },

  // Epic
  iron: {
    id: "iron",
    name: "Iron Axe",
    rarity: "epic",
    modelUri: "models/tools/axe/iron-axe.gltf",
    damage: 35,
    cooldown: 0.80,
    areaRadius: 2.6,
  },
  golden: {
    id: "golden",
    name: "Golden Axe",
    rarity: "epic",
    modelUri: "models/tools/axe/golden-axe.gltf",
    damage: 28,
    cooldown: 0.60, // Fast farmer identity
    areaRadius: 3.0,
  },

  // Mythic
  diamond: {
    id: "diamond",
    name: "Diamond Axe",
    rarity: "mythic",
    modelUri: "models/tools/axe/diamond-axe.gltf",
    damage: 55,
    cooldown: 0.65,
    areaRadius: 3.3,
  },

  // Exotic trio
  ruby: {
    id: "ruby",
    name: "Ruby Axe",
    rarity: "exotic",
    modelUri: "models/tools/axe/ruby-axe.gltf",
    damage: 80, // Highest damage
    cooldown: 0.70,
    areaRadius: 3.3,
  },
  sapphire: {
    id: "sapphire",
    name: "Sapphire Axe",
    rarity: "exotic",
    modelUri: "models/tools/axe/sapphire-axe.gltf",
    damage: 60,
    cooldown: 0.70,
    areaRadius: 4.2, // Biggest area
  },
  emerald: {
    id: "emerald",
    name: "Emerald Axe",
    rarity: "exotic",
    modelUri: "models/tools/axe/emerald-axe.gltf",
    damage: 60,
    cooldown: 0.65,
    areaRadius: 3.3,
    perks: {
      extraRollChance: 0.20, // 20% chance for second roll on chest open
    },
  },
};

/** Get all axes of a specific rarity */
export function getAxesByRarity(rarity: Rarity): AxeDef[] {
  return Object.values(AXES).filter(axe => axe.rarity === rarity);
}

/** Calculate DPS for an axe (damage / cooldown) */
export function getAxeDPS(axe: AxeDef): number {
  return axe.damage / axe.cooldown;
}
