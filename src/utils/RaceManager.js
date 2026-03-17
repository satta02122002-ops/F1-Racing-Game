/**
 * Race Manager
 * Tracks lap timing, sectors, DRS activation, and race state.
 * Emits events for HUD and sound system.
 */

import { closestPointOnTrack } from '../track/TrackLayout.js';

export const RACE_STATE = {
  COUNTDOWN: 'COUNTDOWN',
  RACING:    'RACING',
  FINISHED:  'FINISHED',
  PAUSED:    'PAUSED',
};

export class RaceManager {
  constructor(track, totalLaps = 3) {
    this.track      = track;
    this.totalLaps  = totalLaps;
    this.state      = RACE_STATE.COUNTDOWN;

    this.currentLap = 1;
    this.lapTime    = 0;      // ms
    this.totalTime  = 0;      // ms
    this.bestLap    = Infinity;
    this.lastLap    = null;
    this.lapTimes   = [];

    // Sector timing
    this.sectorTimes    = [0, 0, 0];
    this.bestSectors    = [Infinity, Infinity, Infinity];
    this.currentSector  = 0;
    this._sectorStart   = 0;

    // Lap detection
    this._lastTrackIdx  = 0;
    this._crossedSF     = false;
    this._lapCooldown   = 0;  // seconds (prevent double-count)

    // DRS
    this._drsDetected   = false;
    this._drsUnlockLap  = 2; // DRS available from lap 2 onward

    // Callbacks
    this.onLapComplete    = null;
    this.onSectorComplete = null;
    this.onRaceFinish     = null;
  }

  // -------------------------------------------------------
  start() {
    this.state = RACE_STATE.RACING;
    this._lapStartTime = performance.now();
    this._totalStartTime = performance.now();
  }

  pause()  { this.state = RACE_STATE.PAUSED; }
  resume() { if (this.state === RACE_STATE.PAUSED) this.state = RACE_STATE.RACING; }

  // -------------------------------------------------------
  update(dt, physics) {
    if (this.state !== RACE_STATE.RACING) return;

    this.lapTime   += dt * 1000;
    this.totalTime += dt * 1000;
    this._lapCooldown = Math.max(0, this._lapCooldown - dt);

    const { idx, dist } = closestPointOnTrack(physics.x, physics.z, this.track.centerline);
    const progress = this.track.lapProgress(idx);

    // ---- DRS availability ----
    physics.drsAvailable =
      this.currentLap >= this._drsUnlockLap &&
      this.track.inDRSZone(idx);

    // ---- Sector detection ----
    const sector = this.track.getSector(idx);
    if (sector !== this.currentSector) {
      this._completeSector(this.currentSector);
      this.currentSector = sector;
      this._sectorStart  = this.lapTime;
    }

    // ---- Lap detection (crossing start/finish) ----
    // Detect transition from high-progress back to low (0..0.05)
    const prevProgress = this.track.lapProgress(this._lastTrackIdx);
    if (
      prevProgress > 0.92 &&
      progress < 0.08 &&
      this._lapCooldown <= 0 &&
      this.lapTime > 10000  // minimum 10s lap (prevent instant trigger)
    ) {
      this._completeLap();
    }

    this._lastTrackIdx = idx;
  }

  // -------------------------------------------------------
  _completeSector(sectorIdx) {
    const time = this.lapTime - this._sectorStart;
    this.sectorTimes[sectorIdx] = time;
    const isPurple = time < this.bestSectors[sectorIdx];
    if (isPurple) this.bestSectors[sectorIdx] = time;
    const isPB = time < (this.bestSectors[sectorIdx] * 1.02); // within 2%
    this.onSectorComplete?.(`S${sectorIdx + 1}`, time, isPB, isPurple);
  }

  _completeLap() {
    const lapMs = this.lapTime;
    this.lastLap = lapMs;
    this.lapTimes.push(lapMs);
    this._lapCooldown = 8; // 8 second cooldown after crossing line

    if (lapMs < this.bestLap) this.bestLap = lapMs;

    this.onLapComplete?.(this.currentLap, lapMs, lapMs === this.bestLap);

    if (this.currentLap >= this.totalLaps) {
      this._finishRace();
      return;
    }

    this.currentLap++;
    this.lapTime = 0;
    this.currentSector = 0;
    this._sectorStart  = 0;
    this.sectorTimes   = [0, 0, 0];
  }

  _finishRace() {
    this.state = RACE_STATE.FINISHED;
    this.onRaceFinish?.({
      totalTime: this.totalTime,
      bestLap:   this.bestLap,
      lapTimes:  this.lapTimes,
      laps:      this.totalLaps,
      tyreWear:  0, // will be populated from physics
    });
  }

  // -------------------------------------------------------
  reset() {
    this.state        = RACE_STATE.COUNTDOWN;
    this.currentLap   = 1;
    this.lapTime      = 0;
    this.totalTime    = 0;
    this.bestLap      = Infinity;
    this.lastLap      = null;
    this.lapTimes     = [];
    this.sectorTimes  = [0, 0, 0];
    this.bestSectors  = [Infinity, Infinity, Infinity];
    this.currentSector = 0;
    this._sectorStart  = 0;
    this._lastTrackIdx = 0;
    this._lapCooldown  = 5;
  }
}
