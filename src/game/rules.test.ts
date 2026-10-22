import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ROCKET_CONFIG,
  calculateMissionScore,
  computeRocketStats,
  createInitialPhysicsState,
  createMissionHazards,
  createMissionPads,
  evaluateLanding,
  filterAndRankLeaderboard,
  stepHazards,
  stepRocketPhysics,
  validatePilotSubmission,
} from './rules';
import { LeaderboardEntry } from './types';

test('computeRocketStats varies thrust, fuel, and hull HP across custom parts', () => {
  const baseStats = computeRocketStats(DEFAULT_ROCKET_CONFIG);
  const heavyBoosterStats = computeRocketStats({
    ...DEFAULT_ROCKET_CONFIG,
    noseCone: 'capsule',
    fins: 'twin_boosters',
    plume: 'hyper_magenta',
  });

  assert.ok(heavyBoosterStats.maxThrust > baseStats.maxThrust, 'Twin boosters + hyper plume should increase thrust');
  assert.ok(heavyBoosterStats.fuelCapacity > baseStats.fuelCapacity, 'Twin boosters should increase fuel capacity');
  assert.equal(heavyBoosterStats.maxHullHp, baseStats.maxHullHp + 1, 'Capsule nose cone adds +1 hull pip');
});

test('stepRocketPhysics lifts rocket off launch pad when thrustHeld is active', () => {
  const stats = computeRocketStats(DEFAULT_ROCKET_CONFIG);
  const pads = createMissionPads();
  let state = createInitialPhysicsState(stats);

  for (let i = 0; i < 15; i++) {
    const res = stepRocketPhysics(
      state,
      {
        thrustHeld: true,
        retroHeld: false,
        leftHeld: false,
        rightHeld: false,
        boostJustPressed: false,
      },
      stats,
      0.04,
      pads,
    );
    state = res.state;
  }

  assert.ok(state.y > 0.5, 'Rocket should ascend above launch pad under main thruster burn');
  assert.ok(state.vy > 1.0, 'Rocket vertical velocity should be positive');
  assert.ok(state.fuel < stats.fuelCapacity, 'Thruster burn should consume fuel');
  assert.equal(state.groundedPadId, null, 'Rocket should clear groundedPadId after liftoff');
});

test('evaluateLanding grades perfect, safe, hard, and crash landings accurately', () => {
  const perfect = evaluateLanding(1.2, -3.5, 0.05);
  assert.equal(perfect.grade, 'perfect');
  assert.equal(perfect.hpDamage, 0);

  const safe = evaluateLanding(4.5, -7.2, 0.25);
  assert.equal(safe.grade, 'safe');
  assert.equal(safe.hpDamage, 0);

  const hard = evaluateLanding(5.0, -13.0, 0.35);
  assert.equal(hard.grade, 'hard');
  assert.equal(hard.hpDamage, 1);

  const crash = evaluateLanding(9.0, -21.0, 0.8);
  assert.equal(crash.grade, 'crash');
  assert.equal(crash.hpDamage, 2);
});

test('stepHazards enforces 3 distinct hazard policies and triggers telegraph when rocket approaches solar_turret', () => {
  const hazards = createMissionHazards();
  const policies = new Set(hazards.map((h) => h.policy));
  assert.equal(policies.size, 3, 'Must include drifter, seeker, and solar_turret policies');

  const turret = hazards.find((h) => h.policy === 'solar_turret')!;
  turret.cooldownTimer = 0;

  const stepRes = stepHazards(hazards, turret.x + 4, turret.y + 4, 0.04, 1.0);
  const updatedTurret = stepRes.hazards.find((h) => h.id === turret.id)!;
  assert.ok(updatedTurret.telegraphTimer > 0, 'Solar turret should start windup telegraph when rocket is in range');
  assert.equal(stepRes.telegraphStarted, true);
});

test('validatePilotSubmission and filterAndRankLeaderboard validate and sort entries deterministically', () => {
  const bad = validatePilotSubmission('A', 'SPACENET');
  assert.equal(bad.valid, false);

  const good = validatePilotSubmission('azar_01', 'spacenet');
  assert.equal(good.valid, true);
  assert.equal(good.normalizedCallsign, 'AZAR_01');
  assert.equal(good.normalizedSquad, 'SPACENET');

  const entries: LeaderboardEntry[] = [
    {
      id: '1',
      callsign: 'PILOT_B',
      squadCode: 'ALPHA',
      score: 2100,
      peakAltitude: 250,
      padsLanded: 2,
      ringsCollected: 4,
      outcome: 'defeat',
      rocketConfig: DEFAULT_ROCKET_CONFIG,
      createdAt: '2026-10-21T00:00:00Z',
    },
    {
      id: '2',
      callsign: 'PILOT_A',
      squadCode: 'SPACENET',
      score: 4850,
      peakAltitude: 360,
      padsLanded: 4,
      ringsCollected: 9,
      outcome: 'victory',
      rocketConfig: DEFAULT_ROCKET_CONFIG,
      createdAt: '2026-10-21T00:00:00Z',
    },
  ];

  const rankedAll = filterAndRankLeaderboard(entries, 'ALL');
  assert.equal(rankedAll[0].callsign, 'PILOT_A');

  const rankedSquad = filterAndRankLeaderboard(entries, 'ALPHA');
  assert.equal(rankedSquad.length, 1);
  assert.equal(rankedSquad[0].callsign, 'PILOT_B');

  const totalScore = calculateMissionScore({
    peakAltitude: 360,
    ringsPoints: 1200,
    padsPoints: 1500,
    perfectLandings: 2,
    fuelRemaining: 40,
    victory: true,
  });
  assert.ok(totalScore > 5000);
});
