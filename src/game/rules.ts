import {
  DataRing,
  FlightInputState,
  HazardEntity,
  LandingEvaluation,
  LeaderboardEntry,
  RelayPad,
  RocketComputedStats,
  RocketConfig,
  RocketPhysicsState,
} from './types';

export const DEFAULT_ROCKET_CONFIG: RocketConfig = {
  noseCone: 'aerospike',
  livery: 'spacenet_cyan',
  fins: 'delta_swept',
  plume: 'ion_cyan',
  callsignTag: 'SN-01',
};

export const WORLD_BOUNDS = {
  minX: -65,
  maxX: 65,
  groundY: 0,
  targetOrbitalY: 420,
};

/**
 * Computes physical flight characteristics from modular rocket customization choices.
 */
export function computeRocketStats(config: RocketConfig): RocketComputedStats {
  let maxThrust = 24.5;
  let fuelCapacity = 100;
  let fuelBurnRate = 7.5;
  let rcsTorque = 4.6;
  let angularDamping = 3.2;
  let maxHullHp = 5;
  let massFactor = 1.0;
  let radarRange = 85;

  // Nose Cone modifiers
  if (config.noseCone === 'aerospike') {
    maxThrust += 2.2;
    massFactor -= 0.06;
    radarRange += 15;
  } else if (config.noseCone === 'capsule') {
    maxHullHp += 1;
    angularDamping += 0.6;
  } else if (config.noseCone === 'voxel_command') {
    fuelCapacity += 18;
    rcsTorque += 0.5;
    massFactor += 0.05;
  }

  // Fin Assembly modifiers
  if (config.fins === 'delta_swept') {
    rcsTorque += 0.8;
    angularDamping += 0.4;
  } else if (config.fins === 'grid_fins') {
    rcsTorque += 1.6;
    angularDamping += 1.1;
    fuelBurnRate -= 0.4;
  } else if (config.fins === 'twin_boosters') {
    maxThrust += 4.0;
    fuelCapacity += 25;
    fuelBurnRate += 1.1;
    massFactor += 0.12;
  }

  // Plume / Engine modifiers
  if (config.plume === 'ion_cyan') {
    fuelBurnRate -= 1.0;
  } else if (config.plume === 'plasma_amber') {
    maxThrust += 2.0;
  } else if (config.plume === 'hyper_magenta') {
    maxThrust += 3.2;
    rcsTorque += 0.5;
    fuelBurnRate += 0.6;
  }

  return {
    maxThrust: Number(maxThrust.toFixed(2)),
    fuelCapacity: Math.round(fuelCapacity),
    fuelBurnRate: Number(Math.max(4.5, fuelBurnRate).toFixed(2)),
    rcsTorque: Number(rcsTorque.toFixed(2)),
    angularDamping: Number(angularDamping.toFixed(2)),
    maxHullHp,
    massFactor: Number(massFactor.toFixed(2)),
    radarRange,
  };
}

export function createInitialPhysicsState(stats: RocketComputedStats): RocketPhysicsState {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    fuel: stats.fuelCapacity,
    maxFuel: stats.fuelCapacity,
    hp: stats.maxHullHp,
    maxHp: stats.maxHullHp,
    throttle: 0,
    rcsActive: 0,
    stabilizing: false,
    groundedPadId: 'pad-origin',
    coyoteTimer: 0.12,
    invulnerableTimer: 0,
    boostCooldown: 0,
    distanceTraveled: 0,
    peakAltitude: 0,
  };
}

export function createMissionPads(): RelayPad[] {
  return [
    {
      id: 'pad-origin',
      name: 'SpaceNet Launch Complex 01',
      x: 0,
      y: 0,
      width: 11,
      sector: 1,
      bonusPoints: 0,
      visited: true,
    },
    {
      id: 'pad-stratosphere',
      name: 'Stratosphere Relay Alpha',
      x: -22,
      y: 110,
      width: 10,
      sector: 2,
      bonusPoints: 450,
      visited: false,
    },
    {
      id: 'pad-karman',
      name: 'Karman Line Station 02',
      x: 24,
      y: 225,
      width: 10,
      sector: 3,
      bonusPoints: 750,
      visited: false,
    },
    {
      id: 'pad-geostationary',
      name: 'Mediatama Orbital Core',
      x: 0,
      y: 360,
      width: 12,
      sector: 4,
      bonusPoints: 1500,
      visited: false,
    },
  ];
}

export function createMissionDataRings(): DataRing[] {
  const coords: Array<[number, number, number]> = [
    [0, 32, 150],
    [-8, 62, 150],
    [-18, 90, 200],
    [-10, 142, 220],
    [6, 175, 250],
    [20, 202, 250],
    [12, 260, 300],
    [-12, 295, 320],
    [-4, 330, 400],
  ];
  return coords.map(([x, y, points], idx) => ({
    id: `ring-${idx + 1}`,
    x,
    y,
    radius: 3.8,
    points,
    collected: false,
    phase: idx * 0.7,
  }));
}

export function createMissionHazards(): HazardEntity[] {
  return [
    // Policy 1: Drifting Voxel Asteroids (patrol horizontal sine corridors)
    {
      id: 'haz-drift-1',
      policy: 'drifter',
      x: 16,
      y: 52,
      vx: -5.2,
      vy: 0,
      radius: 2.3,
      hp: 2,
      maxHp: 2,
      telegraphTimer: 0,
      attackActiveTimer: 0,
      cooldownTimer: 0,
      orbitPhase: 0,
      anchorX: 0,
      anchorY: 52,
      hitFlashTimer: 0,
      koTimer: 0,
    },
    {
      id: 'haz-drift-2',
      policy: 'drifter',
      x: -20,
      y: 155,
      vx: 6.4,
      vy: 0,
      radius: 2.6,
      hp: 2,
      maxHp: 2,
      telegraphTimer: 0,
      attackActiveTimer: 0,
      cooldownTimer: 0,
      orbitPhase: 1.4,
      anchorX: 0,
      anchorY: 155,
      hitFlashTimer: 0,
      koTimer: 0,
    },
    // Policy 2: Orbital Seeker Drones (orbit anchor until player enters range, then flank/pursue)
    {
      id: 'haz-seeker-1',
      policy: 'seeker',
      x: 14,
      y: 128,
      vx: 0,
      vy: 0,
      radius: 2.0,
      hp: 2,
      maxHp: 2,
      telegraphTimer: 0,
      attackActiveTimer: 0,
      cooldownTimer: 0,
      orbitPhase: 0.5,
      anchorX: 12,
      anchorY: 128,
      hitFlashTimer: 0,
      koTimer: 0,
    },
    {
      id: 'haz-seeker-2',
      policy: 'seeker',
      x: -16,
      y: 272,
      vx: 0,
      vy: 0,
      radius: 2.1,
      hp: 2,
      maxHp: 2,
      telegraphTimer: 0,
      attackActiveTimer: 0,
      cooldownTimer: 0,
      orbitPhase: 2.1,
      anchorX: -14,
      anchorY: 272,
      hitFlashTimer: 0,
      koTimer: 0,
    },
    // Policy 3: Solar Pulse Turrets (stationary defense satellites with 0.65s windup telegraph before pulse burst)
    {
      id: 'haz-turret-1',
      policy: 'solar_turret',
      x: -6,
      y: 192,
      vx: 0,
      vy: 0,
      radius: 2.4,
      hp: 3,
      maxHp: 3,
      telegraphTimer: 0,
      attackActiveTimer: 0,
      cooldownTimer: 2.2,
      orbitPhase: 0,
      anchorX: -6,
      anchorY: 192,
      hitFlashTimer: 0,
      koTimer: 0,
    },
    {
      id: 'haz-turret-2',
      policy: 'solar_turret',
      x: 10,
      y: 318,
      vx: 0,
      vy: 0,
      radius: 2.4,
      hp: 3,
      maxHp: 3,
      telegraphTimer: 0,
      attackActiveTimer: 0,
      cooldownTimer: 1.8,
      orbitPhase: 1.2,
      anchorX: 10,
      anchorY: 318,
      hitFlashTimer: 0,
      koTimer: 0,
    },
  ];
}

/**
 * Evaluates a rocket touchdown based on vertical speed, horizontal drift, and tilt angle.
 */
export function evaluateLanding(vx: number, vy: number, angleRad: number): LandingEvaluation {
  const speedY = Math.abs(vy);
  const speedX = Math.abs(vx);
  const tiltDeg = Math.abs((angleRad * 180) / Math.PI);

  if (speedY <= 4.8 && speedX <= 3.2 && tiltDeg <= 12) {
    return {
      grade: 'perfect',
      scoreAwarded: 500,
      hpDamage: 0,
      label: 'PERFECT TELEMETRY LOCK',
    };
  }
  if (speedY <= 9.5 && speedX <= 6.5 && tiltDeg <= 24) {
    return {
      grade: 'safe',
      scoreAwarded: 250,
      hpDamage: 0,
      label: 'SAFE PAD TOUCHDOWN',
    };
  }
  if (speedY <= 15.0 && tiltDeg <= 38) {
    return {
      grade: 'hard',
      scoreAwarded: 75,
      hpDamage: 1,
      label: 'HARD LANDING - GEAR STRAIN',
    };
  }
  return {
    grade: 'crash',
    scoreAwarded: 0,
    hpDamage: 2,
    label: 'CRITICAL IMPACT VELOCITY',
  };
}

export interface StepPhysicsResult {
  state: RocketPhysicsState;
  landedPad: RelayPad | null;
  landingEval: LandingEvaluation | null;
  usedBoost: boolean;
}

/**
 * Pure simulation step for the rocket with clamped dt <= 0.05s, altitude-scaled gravity,
 * gimbal pitch torque, retro-stabilizer, and Relay Pad collision detection.
 */
export function stepRocketPhysics(
  prev: RocketPhysicsState,
  input: FlightInputState,
  stats: RocketComputedStats,
  rawDt: number,
  pads: RelayPad[],
): StepPhysicsResult {
  const dt = Math.min(Math.max(rawDt, 0.0001), 0.05);
  const next: RocketPhysicsState = { ...prev };

  next.invulnerableTimer = Math.max(0, next.invulnerableTimer - dt);
  next.boostCooldown = Math.max(0, next.boostCooldown - dt);

  // Altitude-attenuated gravity (9.8 m/s^2 at pad, tapering gently to 6.2 m/s^2 in high orbit)
  const altitudeRatio = Math.min(1, Math.max(0, next.y / WORLD_BOUNDS.targetOrbitalY));
  const gravity = 9.8 - altitudeRatio * 3.6;

  // Rotational RCS input
  let torqueInput = 0;
  if (input.leftHeld) torqueInput += 1;
  if (input.rightHeld) torqueInput -= 1;
  next.rcsActive = torqueInput;

  if (torqueInput !== 0) {
    next.angularVelocity += torqueInput * stats.rcsTorque * dt;
    next.stabilizing = false;
  } else if (input.retroHeld || Math.abs(next.angle) > 0.01) {
    // Auto-attitude damping + stronger retro-attitude trim when holding S/Down
    const dampStrength = input.retroHeld ? stats.angularDamping * 2.2 : stats.angularDamping * 0.65;
    next.angularVelocity -= next.angle * dampStrength * dt;
    next.stabilizing = input.retroHeld;
  }

  // Apply angular damping
  next.angularVelocity *= Math.exp(-stats.angularDamping * 0.7 * dt);
  next.angle += next.angularVelocity * dt;
  // Clamp tilt within +/- 75 degrees so players don't flip upside down uncontrollably
  const maxTilt = (75 * Math.PI) / 180;
  if (next.angle > maxTilt) {
    next.angle = maxTilt;
    next.angularVelocity = Math.min(0, next.angularVelocity);
  } else if (next.angle < -maxTilt) {
    next.angle = -maxTilt;
    next.angularVelocity = Math.max(0, next.angularVelocity);
  }

  // Emergency RCS Stabilizer & Impulse Boost (Shift)
  let usedBoost = false;
  if (input.boostJustPressed && next.boostCooldown <= 0 && next.fuel >= 6) {
    usedBoost = true;
    next.boostCooldown = 2.0;
    next.fuel = Math.max(0, next.fuel - 6);
    next.angle *= 0.25;
    next.angularVelocity = 0;
    next.vy = Math.max(next.vy + 7.5, 6.5);
    next.groundedPadId = null;
  }

  // Main Thruster throttle
  const canBurn = next.fuel > 0.01;
  if (input.thrustHeld && canBurn) {
    next.throttle = Math.min(1, next.throttle + dt * 6.5);
  } else {
    next.throttle = Math.max(0, next.throttle - dt * 8.0);
  }

  const prevX = next.x;
  const prevY = next.y;

  if (next.throttle > 0 && canBurn) {
    const effectiveAccel = (stats.maxThrust / stats.massFactor) * next.throttle;
    const thrustX = -Math.sin(next.angle) * effectiveAccel;
    const thrustY = Math.cos(next.angle) * effectiveAccel;

    next.vx += thrustX * dt;
    next.vy += thrustY * dt;
    next.fuel = Math.max(0, next.fuel - stats.fuelBurnRate * next.throttle * dt);

    if (next.vy > 0.5) {
      next.groundedPadId = null;
    }
  }

  // Retro-braking drag when holding S/Down in flight
  if (input.retroHeld && !next.groundedPadId) {
    next.vx *= Math.exp(-1.8 * dt);
    if (next.vy < -2.0) {
      next.vy += 4.2 * dt;
    }
  }

  // Apply gravity & atmospheric drag when airborne
  if (!next.groundedPadId) {
    next.coyoteTimer = Math.max(0, next.coyoteTimer - dt);
    next.vy -= gravity * dt;
    const airDensity = Math.max(0.12, 1 - altitudeRatio * 0.75);
    next.vx *= Math.exp(-0.28 * airDensity * dt);
    next.vy *= Math.exp(-0.08 * airDensity * dt);

    next.x += next.vx * dt;
    next.y += next.vy * dt;
  } else {
    // Resting on a pad: refuel smoothly and keep upright
    next.coyoteTimer = 0.12;
    next.vx = 0;
    next.vy = 0;
    next.angle *= Math.exp(-10 * dt);
    next.angularVelocity = 0;
    next.fuel = Math.min(next.maxFuel, next.fuel + 22 * dt);
  }

  // Keep within horizontal sector corridor with soft magnetic boundary pushback
  if (next.x < WORLD_BOUNDS.minX) {
    next.x = WORLD_BOUNDS.minX;
    next.vx = Math.abs(next.vx) * 0.5;
  } else if (next.x > WORLD_BOUNDS.maxX) {
    next.x = WORLD_BOUNDS.maxX;
    next.vx = -Math.abs(next.vx) * 0.5;
  }

  let landedPad: RelayPad | null = null;
  let landingEval: LandingEvaluation | null = null;

  // Check pad landings when descending
  if (!next.groundedPadId && next.vy <= 0) {
    for (const pad of pads) {
      const halfW = pad.width * 0.52;
      const crossedY = prevY >= pad.y - 0.25 && next.y <= pad.y + 0.35;
      const withinX = Math.abs(next.x - pad.x) <= halfW;
      if (crossedY && withinX) {
        landingEval = evaluateLanding(next.vx, next.vy, next.angle);
        next.y = pad.y;
        next.vx = 0;
        next.vy = 0;
        next.angle = 0;
        next.angularVelocity = 0;
        next.groundedPadId = pad.id;
        next.throttle = 0;
        landedPad = pad;
        if (landingEval.hpDamage > 0 && next.invulnerableTimer <= 0) {
          next.hp = Math.max(0, next.hp - landingEval.hpDamage);
          next.invulnerableTimer = 1.2;
        }
        break;
      }
    }
  }

  // Check ground floor impact outside the launch pad
  if (!next.groundedPadId && next.y < WORLD_BOUNDS.groundY) {
    landingEval = evaluateLanding(next.vx, next.vy - 3, next.angle);
    next.y = WORLD_BOUNDS.groundY;
    next.vy = Math.abs(next.vy) * 0.35;
    next.vx *= 0.5;
    next.angle *= 0.4;
    if (next.invulnerableTimer <= 0) {
      const dmg = Math.max(1, landingEval.hpDamage);
      next.hp = Math.max(0, next.hp - dmg);
      next.invulnerableTimer = 1.2;
    }
  }

  const stepDist = Math.hypot(next.x - prevX, next.y - prevY);
  next.distanceTraveled += stepDist;
  next.peakAltitude = Math.max(next.peakAltitude, next.y);

  return {
    state: next,
    landedPad,
    landingEval,
    usedBoost,
  };
}

/**
 * Steps the 3 distinct hazard policies with an attack token pool (max 2 simultaneous telegraphs/attacks).
 */
export function stepHazards(
  hazards: HazardEntity[],
  rocketX: number,
  rocketY: number,
  rawDt: number,
  elapsed: number,
): { hazards: HazardEntity[]; rocketPulseHit: boolean; telegraphStarted: boolean } {
  const dt = Math.min(Math.max(rawDt, 0.0001), 0.05);
  let activeTokens = hazards.filter((h) => h.telegraphTimer > 0 || h.attackActiveTimer > 0).length;
  const maxConcurrentAttackers = 2;
  let rocketPulseHit = false;
  let telegraphStarted = false;

  const updated = hazards.map((h) => {
    const next = { ...h };
    next.hitFlashTimer = Math.max(0, next.hitFlashTimer - dt);
    if (next.koTimer > 0) {
      next.koTimer = Math.max(0, next.koTimer - dt);
      next.y -= 8 * dt;
      return next;
    }

    const dx = rocketX - next.x;
    const dy = rocketY - next.y;
    const dist = Math.hypot(dx, dy);

    if (next.policy === 'drifter') {
      // Policy 1: Horizontal corridor sweep + vertical bob
      next.x += next.vx * dt;
      if (next.x > 34) {
        next.x = 34;
        next.vx = -Math.abs(next.vx);
      } else if (next.x < -34) {
        next.x = -34;
        next.vx = Math.abs(next.vx);
      }
      next.y = next.anchorY + Math.sin(elapsed * 1.6 + next.orbitPhase) * 2.5;
    } else if (next.policy === 'seeker') {
      // Policy 2: Orbit patrol when far; flank/intercept with telegraph when within 38m
      if (dist < 38 && activeTokens < maxConcurrentAttackers) {
        if (next.telegraphTimer <= 0 && next.cooldownTimer <= 0) {
          next.telegraphTimer = 0.45;
          next.cooldownTimer = 3.2;
          activeTokens++;
          telegraphStarted = true;
        }
      }
      next.cooldownTimer = Math.max(0, next.cooldownTimer - dt);
      if (next.telegraphTimer > 0) {
        next.telegraphTimer = Math.max(0, next.telegraphTimer - dt);
        if (next.telegraphTimer === 0 && dist > 0.1) {
          // Dash toward rocket position
          next.vx = (dx / dist) * 14.5;
          next.vy = (dy / dist) * 14.5;
          next.attackActiveTimer = 0.9;
        }
      } else if (next.attackActiveTimer > 0) {
        next.attackActiveTimer = Math.max(0, next.attackActiveTimer - dt);
        next.x += next.vx * dt;
        next.y += next.vy * dt;
      } else {
        // Return smoothly to orbital figure-eight around anchor
        const targetX = next.anchorX + Math.cos(elapsed * 1.4 + next.orbitPhase) * 9;
        const targetY = next.anchorY + Math.sin(elapsed * 2.8 + next.orbitPhase) * 4;
        next.x += (targetX - next.x) * Math.min(1, dt * 3.0);
        next.y += (targetY - next.y) * Math.min(1, dt * 3.0);
      }
    } else if (next.policy === 'solar_turret') {
      // Policy 3: Stationary satellite with 0.65s visual/audio windup telegraph before radial EMP pulse
      next.cooldownTimer = Math.max(0, next.cooldownTimer - dt);
      if (dist < 32 && next.cooldownTimer <= 0 && next.telegraphTimer <= 0 && activeTokens < maxConcurrentAttackers) {
        next.telegraphTimer = 0.65;
        next.cooldownTimer = 4.2;
        activeTokens++;
        telegraphStarted = true;
      }
      if (next.telegraphTimer > 0) {
        next.telegraphTimer = Math.max(0, next.telegraphTimer - dt);
        if (next.telegraphTimer === 0) {
          next.attackActiveTimer = 0.35;
          if (dist <= 11.5) {
            rocketPulseHit = true;
          }
        }
      } else if (next.attackActiveTimer > 0) {
        next.attackActiveTimer = Math.max(0, next.attackActiveTimer - dt);
      }
    }

    return next;
  });

  return { hazards: updated, rocketPulseHit, telegraphStarted };
}

export function calculateMissionScore(params: {
  peakAltitude: number;
  ringsPoints: number;
  padsPoints: number;
  perfectLandings: number;
  fuelRemaining: number;
  victory: boolean;
}): number {
  const altitudeScore = Math.round(params.peakAltitude * 4.5);
  const masteryBonus = params.perfectLandings * 300;
  const fuelBonus = Math.round(params.fuelRemaining * 3.5);
  const victoryBonus = params.victory ? 1200 : 0;
  return Math.max(0, altitudeScore + params.ringsPoints + params.padsPoints + masteryBonus + fuelBonus + victoryBonus);
}

export function validatePilotSubmission(callsign: string, squadCode: string): {
  valid: boolean;
  error?: string;
  normalizedCallsign: string;
  normalizedSquad: string;
} {
  const trimmedCallsign = callsign.trim().toUpperCase();
  const trimmedSquad = (squadCode.trim() || 'SPACENET').toUpperCase();

  if (trimmedCallsign.length < 2 || trimmedCallsign.length > 16) {
    return {
      valid: false,
      error: 'Callsign must be between 2 and 16 characters.',
      normalizedCallsign: trimmedCallsign,
      normalizedSquad: trimmedSquad,
    };
  }

  if (!/^[A-Z0-9_-]+$/.test(trimmedCallsign)) {
    return {
      valid: false,
      error: 'Callsign can only contain letters, numbers, hyphens, and underscores.',
      normalizedCallsign: trimmedCallsign,
      normalizedSquad: trimmedSquad,
    };
  }

  if (!/^[A-Z0-9_-]{2,12}$/.test(trimmedSquad)) {
    return {
      valid: false,
      error: 'Squad code must be 2–12 alphanumeric characters.',
      normalizedCallsign: trimmedCallsign,
      normalizedSquad: trimmedSquad,
    };
  }

  return {
    valid: true,
    normalizedCallsign: trimmedCallsign,
    normalizedSquad: trimmedSquad,
  };
}

export function filterAndRankLeaderboard(
  entries: LeaderboardEntry[],
  squadFilter: string = 'ALL',
): LeaderboardEntry[] {
  const normalizedFilter = squadFilter.trim().toUpperCase();
  const filtered =
    normalizedFilter === 'ALL' || normalizedFilter === ''
      ? entries
      : entries.filter((e) => e.squadCode.toUpperCase() === normalizedFilter);

  return [...filtered].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.peakAltitude - a.peakAltitude;
  });
}
