export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type NoseConeType = 'aerospike' | 'capsule' | 'voxel_command';
export type HullLiveryType = 'spacenet_cyan' | 'retro_arcade' | 'solar_gold' | 'stealth_obsidian';
export type FinType = 'delta_swept' | 'grid_fins' | 'twin_boosters';
export type PlumeType = 'ion_cyan' | 'plasma_amber' | 'hyper_magenta';
export type CameraPreset = 'chase' | 'arcade_ortho' | 'cockpit' | 'turntable';

export interface RocketConfig {
  noseCone: NoseConeType;
  livery: HullLiveryType;
  fins: FinType;
  plume: PlumeType;
  callsignTag: string;
}

export interface RocketComputedStats {
  maxThrust: number;       // m/s^2 upward acceleration potential
  fuelCapacity: number;    // total fuel units
  fuelBurnRate: number;    // units per second at 100% throttle
  rcsTorque: number;       // rad/s^2 rotational authority
  angularDamping: number;  // rotational stabilization rate
  maxHullHp: number;       // discrete hull pips (4 to 6)
  massFactor: number;      // relative mass (0.85 to 1.25)
  radarRange: number;      // waypoint sensor radius
}

export interface RocketPhysicsState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;           // radians, 0 = straight up, positive = tilted left, negative = tilted right
  angularVelocity: number;
  fuel: number;
  maxFuel: number;
  hp: number;
  maxHp: number;
  throttle: number;        // 0..1
  rcsActive: number;       // -1 (right), 0, +1 (left)
  stabilizing: boolean;
  groundedPadId: string | null;
  coyoteTimer: number;
  invulnerableTimer: number;
  boostCooldown: number;
  distanceTraveled: number;
  peakAltitude: number;
}

export interface FlightInputState {
  thrustHeld: boolean;
  retroHeld: boolean;
  leftHeld: boolean;
  rightHeld: boolean;
  boostJustPressed: boolean;
}

export interface RelayPad {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  sector: number;
  bonusPoints: number;
  visited: boolean;
}

export interface DataRing {
  id: string;
  x: number;
  y: number;
  radius: number;
  points: number;
  collected: boolean;
  phase: number;
}

export type HazardPolicy = 'drifter' | 'seeker' | 'solar_turret';

export interface HazardEntity {
  id: string;
  policy: HazardPolicy;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  telegraphTimer: number; // > 0 when winding up an attack
  attackActiveTimer: number;
  cooldownTimer: number;
  orbitPhase: number;
  anchorX: number;
  anchorY: number;
  hitFlashTimer: number;
  koTimer: number;        // > 0 when toppling/dissolving before removal
}

export type LandingGrade = 'perfect' | 'safe' | 'hard' | 'crash';

export interface LandingEvaluation {
  grade: LandingGrade;
  scoreAwarded: number;
  hpDamage: number;
  label: string;
}

export interface RunSnapshot {
  outcome: 'victory' | 'defeat';
  reason: string;
  score: number;
  bestScore: number;
  peakAltitude: number;
  sectorReached: number;
  ringsCollected: number;
  totalRings: number;
  padsLanded: number;
  perfectLandings: number;
  clearTimeSeconds: number;
  rocketConfig: RocketConfig;
}

export interface LeaderboardEntry {
  id: string;
  callsign: string;
  squadCode: string;
  score: number;
  peakAltitude: number;
  padsLanded: number;
  ringsCollected: number;
  outcome: 'victory' | 'defeat';
  rocketConfig: RocketConfig;
  createdAt: string;
}
