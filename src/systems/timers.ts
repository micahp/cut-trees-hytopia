/**
 * Tick-aligned timer manager for respawn timers and scheduled game logic.
 * Ties timers to world loop ticks so they pause when the world loop stops.
 */

import { WorldLoopEvent } from 'hytopia';

type TimerId = number;

interface TimeoutEntry {
  targetTick: number;
  callback: () => void;
}

interface IntervalEntry {
  intervalTicks: number;
  nextTick: number;
  callback: () => void;
}

export class WorldLoopTimerManager {
  private world: any;
  private timeouts = new Map<TimerId, TimeoutEntry>();
  private intervals = new Map<TimerId, IntervalEntry>();
  private nextId: TimerId = 1;

  constructor(world: any) {
    this.world = world;
    
    // Listen to tick end for timer processing
    this.world.loop.on(WorldLoopEvent.TICK_END, ({ worldLoop }: any) => {
      this.processTick(worldLoop.currentTick);
    });
  }

  private processTick(currentTick: number): void {
    // Process timeouts
    for (const [id, entry] of Array.from(this.timeouts.entries())) {
      if (currentTick >= entry.targetTick) {
        try {
          entry.callback();
        } catch (error) {
          console.error(`[Timers] Error in timeout ${id}:`, error);
        }
        this.timeouts.delete(id);
      }
    }

    // Process intervals
    for (const [id, entry] of Array.from(this.intervals.entries())) {
      if (currentTick >= entry.nextTick) {
        try {
          entry.callback();
        } catch (error) {
          console.error(`[Timers] Error in interval ${id}:`, error);
        }
        entry.nextTick = currentTick + entry.intervalTicks;
      }
    }
  }

  /**
   * Convert milliseconds to ticks based on world timestep
   */
  private msToTicks(ms: number): number {
    const tickDurationMs = this.world.loop.timestepS * 1000;
    return Math.max(1, Math.ceil(ms / tickDurationMs));
  }

  /**
   * Schedule a one-shot callback after delay (in world time)
   */
  setTimeout(delayMs: number, callback: () => void): TimerId {
    const ticks = this.msToTicks(delayMs);
    const id = this.nextId++;
    const targetTick = this.world.loop.currentTick + ticks;
    
    this.timeouts.set(id, { targetTick, callback });
    return id;
  }

  /**
   * Cancel a scheduled timeout
   */
  clearTimeout(id: TimerId): void {
    this.timeouts.delete(id);
  }

  /**
   * Schedule a repeating callback (in world time)
   */
  setInterval(intervalMs: number, callback: () => void): TimerId {
    const intervalTicks = this.msToTicks(intervalMs);
    const id = this.nextId++;
    const nextTick = this.world.loop.currentTick + intervalTicks;
    
    this.intervals.set(id, { intervalTicks, nextTick, callback });
    return id;
  }

  /**
   * Cancel a scheduled interval
   */
  clearInterval(id: TimerId): void {
    this.intervals.delete(id);
  }

  /**
   * Get current tick count
   */
  get currentTick(): number {
    return this.world.loop.currentTick;
  }
}
