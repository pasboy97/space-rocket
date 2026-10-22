import React, { useEffect, useState } from 'react';
import { HudTelemetryPayload } from './RocketViewport3D';

interface PlayingHudProps {
  telemetry: HudTelemetryPayload;
  bestScore: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onCycleCamera: () => void;
  onOpenLeaderboard: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
  touchInputRef: React.MutableRefObject<{
    thrust: boolean;
    retro: boolean;
    left: boolean;
    right: boolean;
    boost: boolean;
  }>;
}

export const PlayingHud: React.FC<PlayingHudProps> = ({
  telemetry,
  bestScore,
  isMuted,
  onToggleMute,
  onCycleCamera,
  onOpenLeaderboard,
  onTogglePause,
  onRestart,
  touchInputRef,
}) => {
  const {
    physics,
    score,
    combo,
    sector,
    ringsCollected,
    totalRings,
    padsLanded,
    nearestPad,
    statusBanner,
  } = telemetry;

  // Delayed trailing ghost bar for propellant drain
  const fuelPct = Math.max(0, Math.min(100, (physics.fuel / Math.max(1, physics.maxFuel)) * 100));
  const [ghostFuelPct, setGhostFuelPct] = useState(fuelPct);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGhostFuelPct((prev) => (fuelPct < prev ? prev + (fuelPct - prev) * 0.45 : fuelPct));
    }, 140);
    return () => clearTimeout(timer);
  }, [fuelPct]);

  const speedVertical = Math.round(physics.vy);
  const speedHorizontal = Math.round(physics.vx);
  const altitude = Math.max(0, Math.round(physics.y));
  const targetProgressPct = Math.min(100, Math.round((altitude / 360) * 100));
  const isCriticalHp = physics.hp <= 1;

  return (
    <div
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-5"
      style={{
        boxShadow: isCriticalHp ? 'inset 0 0 70px rgba(239, 68, 68, 0.35)' : 'none',
      }}
    >
      {/* Top Wrapper: Perimeter Corner Clusters + Top-Anchored Transient Callout */}
      <div className="flex flex-col items-center gap-2 w-full">
        <div className="flex items-start justify-between gap-2 w-full">
          {/* Cluster 1 (Top-Left): Vitality Pips, Propellant Bar & Flight Kinematics */}
          <div className="pixel-panel rounded-lg px-2.5 py-2 sm:px-3.5 sm:py-2.5 w-[205px] sm:w-[255px] shrink-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div>
                <span className="block text-[10px] font-semibold tracking-wider text-slate-400">
                  HULL
                </span>
                {/* Discrete SVG Hull Vitality Sockets: Full, Cracked/Damaged, Empty Hollow */}
                <div
                  className="flex items-center gap-1 mt-0.5"
                  aria-label={`Hull Integrity ${physics.hp} of ${physics.maxHp}`}
                >
                  {Array.from({ length: physics.maxHp }).map((_, i) => {
                    const isFull = i < physics.hp;
                    const isLastDamaged = i === physics.hp && physics.hp < physics.maxHp;
                    return (
                      <svg
                        key={i}
                        viewBox="0 0 24 24"
                        className="w-4 h-4 sm:w-5 sm:h-5"
                        aria-hidden="true"
                      >
                        <polygon
                          points="12,2 21,7 21,17 12,22 3,17 3,7"
                          fill="#050911"
                          stroke={isFull ? '#38BDF8' : isLastDamaged ? '#F59E0B' : '#334155'}
                          strokeWidth="2"
                        />
                        {isFull && (
                          <>
                            <polygon
                              points="12,4 19,8 19,16 12,20 5,16 5,8"
                              fill="#0EA5E9"
                            />
                            <polygon points="12,5 17,8 12,11 7,8" fill="#BAE6FD" />
                          </>
                        )}
                        {isLastDamaged && (
                          <>
                            <polygon
                              points="12,4 19,8 19,16 12,20 5,16 5,8"
                              fill="#78350F"
                            />
                            <path
                              d="M9 5 L14 11 L10 14 L15 19"
                              stroke="#F59E0B"
                              strokeWidth="2"
                              fill="none"
                            />
                          </>
                        )}
                      </svg>
                    );
                  })}
                </div>
              </div>

              <div className="text-right">
                <span className="block text-[10px] font-semibold tracking-wider text-slate-400">
                  ALTITUDE
                </span>
                <span className="font-mono-tabular text-lg sm:text-2xl font-bold text-white hud-stroke">
                  {altitude}m
                </span>
              </div>
            </div>

            {/* Propellant Bar with Delayed Trailing Ghost Bar */}
            <div className="mb-1.5">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] mb-1">
                <span className="font-semibold text-slate-300">FUEL</span>
                <span className="font-mono-tabular font-bold text-[#38BDF8]">
                  {Math.round(physics.fuel)} / {physics.maxFuel} L
                </span>
              </div>
              <div className="relative h-2 w-full bg-slate-950 rounded overflow-hidden border border-slate-800">
                <div
                  className="absolute inset-y-0 left-0 bg-amber-400/50 transition-all duration-150"
                  style={{ width: `${ghostFuelPct}%` }}
                />
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-75 ${
                    fuelPct < 22 ? 'bg-rose-500' : 'bg-[#0EA5E9]'
                  }`}
                  style={{ width: `${fuelPct}%` }}
                />
              </div>
            </div>

            {/* Vertical & Horizontal Speed Readout */}
            <div className="flex items-center justify-between text-[11px] sm:text-xs border-t border-slate-800/80 pt-1 font-mono-tabular whitespace-nowrap">
              <span className="text-slate-300">
                V:{' '}
                <strong
                  className={
                    speedVertical < -9
                      ? 'text-rose-400'
                      : speedVertical >= 0
                      ? 'text-emerald-400'
                      : 'text-amber-300'
                  }
                >
                  {speedVertical > 0 ? `+${speedVertical}` : speedVertical}m/s
                </strong>
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">
                H: <strong>{speedHorizontal}m/s</strong>
              </span>
            </div>
          </div>

          {/* Cluster 2 (Top-Center): Score, Combo & Orbital Progress */}
          <div className="pixel-panel rounded-lg px-4 py-2 text-center hidden md:block">
            <div className="flex items-center justify-center gap-5">
              <div>
                <span className="block text-[10px] font-semibold tracking-wider text-slate-400">
                  MISSION SCORE
                </span>
                <span
                  data-testid="hud-score"
                  className="font-mono-tabular text-2xl font-bold text-white hud-stroke"
                >
                  {score}
                </span>
              </div>

              <div className="h-7 w-px bg-slate-800" />

              <div>
                <span className="block text-[10px] font-semibold tracking-wider text-slate-400">
                  SYNC MULTIPLIER
                </span>
                <span className="font-mono-tabular text-xl font-bold text-amber-400 hud-stroke">
                  {combo}x
                </span>
              </div>

              <div className="h-7 w-px bg-slate-800" />

              <div>
                <span className="block text-[10px] font-semibold tracking-wider text-slate-400">
                  SECTOR {sector} / 4
                </span>
                <span className="font-mono-tabular text-xs font-semibold text-[#38BDF8]">
                  Rings {ringsCollected}/{totalRings} · Pads {padsLanded}/4 ({targetProgressPct}%)
                </span>
              </div>
            </div>

            {nearestPad && nearestPad.dist < 52 && (
              <div className="mt-1.5 pt-1 border-t border-slate-800/80 text-xs font-mono-tabular flex items-center justify-center gap-2">
                <span className="text-slate-300">{nearestPad.name}:</span>
                <span className="text-[#38BDF8] font-bold">{nearestPad.dist}m</span>
                <span>·</span>
                <span
                  className={
                    nearestPad.safeSpeed
                      ? 'text-emerald-400 font-semibold'
                      : 'text-amber-400 font-semibold'
                  }
                >
                  {nearestPad.safeSpeed ? 'LANDING SPEED OK' : 'SLOW DOWN (<9 m/s)'}
                </span>
              </div>
            )}
          </div>

          {/* Cluster 3 (Top-Right): Square SVG Utility Action Buttons */}
          <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              tabIndex={-1}
              aria-label={isMuted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
              title="Mute / Unmute Audio [M]"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-8 h-8 sm:w-10 sm:h-10 pixel-panel rounded flex items-center justify-center text-slate-200 hover:text-white hover:border-[#38BDF8] transition-colors cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                {isMuted ? (
                  <>
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </>
                ) : (
                  <>
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </>
                )}
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Cycle Camera Angle [C]"
              title="Cycle Camera View [C]"
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleCamera();
              }}
              className="w-8 h-8 sm:w-10 sm:h-10 pixel-panel rounded flex items-center justify-center text-slate-200 hover:text-white hover:border-[#38BDF8] transition-colors cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Open Global Leaderboard [L]"
              title="Global Leaderboard [L]"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenLeaderboard();
              }}
              className="w-8 h-8 sm:w-10 sm:h-10 pixel-panel rounded flex items-center justify-center text-amber-400 hover:text-amber-300 hover:border-amber-400 transition-colors cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Restart Mission [R]"
              title="Restart Mission [R]"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="w-8 h-8 sm:w-10 sm:h-10 pixel-panel rounded flex items-center justify-center text-slate-200 hover:text-white hover:border-[#38BDF8] transition-colors cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause Mission [P]"
              title="Pause Game [P / Esc]"
              onClick={(e) => {
                e.currentTarget.blur();
                onTogglePause();
              }}
              className="w-8 h-8 sm:w-10 sm:h-10 pixel-panel rounded flex items-center justify-center text-slate-200 hover:text-white hover:border-[#38BDF8] transition-colors cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Transient Event Callout Banner (Anchored directly under top HUD, never over center rocket) */}
        {statusBanner && (
          <div className="px-3.5 py-1 pixel-panel rounded text-[11px] sm:text-xs font-display font-bold tracking-wider text-[#38BDF8] text-center">
            {statusBanner}
          </div>
        )}
      </div>

      {/* Center Gaze-Routed Boost Cooldown Cue */}
      {physics.boostCooldown > 0 && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 translate-y-12 pointer-events-none px-2 py-0.5 bg-slate-950/85 border border-slate-700 rounded text-[11px] font-mono-tabular text-amber-300">
          RCS BOOST {physics.boostCooldown.toFixed(1)}s
        </div>
      )}

      {/* Mobile Touch Flight Controls (Positioned cleanly above the bottom drawer button) */}
      <div className="flex sm:hidden items-center justify-between w-full mb-10 pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Pitch Left"
            onPointerDown={() => {
              touchInputRef.current.left = true;
            }}
            onPointerUp={() => {
              touchInputRef.current.left = false;
            }}
            onPointerLeave={() => {
              touchInputRef.current.left = false;
            }}
            className="w-11 h-11 pixel-panel rounded-lg font-mono-tabular font-bold text-xs text-white active:bg-[#1488B8]"
          >
            LEFT
          </button>
          <button
            type="button"
            aria-label="Pitch Right"
            onPointerDown={() => {
              touchInputRef.current.right = true;
            }}
            onPointerUp={() => {
              touchInputRef.current.right = false;
            }}
            onPointerLeave={() => {
              touchInputRef.current.right = false;
            }}
            className="w-11 h-11 pixel-panel rounded-lg font-mono-tabular font-bold text-xs text-white active:bg-[#1488B8]"
          >
            RGHT
          </button>
        </div>

        <div className="pixel-panel rounded px-2.5 py-1 text-center font-mono-tabular text-[11px] text-slate-200">
          <div className="font-bold text-amber-400">{score} PTS</div>
          <div className="text-[10px] text-slate-400">S{sector}/4 · {combo}x</div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Retro Brake"
            onPointerDown={() => {
              touchInputRef.current.retro = true;
            }}
            onPointerUp={() => {
              touchInputRef.current.retro = false;
            }}
            onPointerLeave={() => {
              touchInputRef.current.retro = false;
            }}
            className="w-11 h-11 pixel-panel rounded-lg font-mono-tabular font-bold text-xs text-amber-300 active:bg-amber-600"
          >
            BRK
          </button>
          <button
            type="button"
            aria-label="Main Thruster Burn"
            onPointerDown={() => {
              touchInputRef.current.thrust = true;
            }}
            onPointerUp={() => {
              touchInputRef.current.thrust = false;
            }}
            onPointerLeave={() => {
              touchInputRef.current.thrust = false;
            }}
            className="w-14 h-11 bg-[#1488B8] border-2 border-[#38BDF8] rounded-lg font-display font-bold text-xs text-white active:bg-[#0EA5E9]"
          >
            BURN
          </button>
        </div>
      </div>
    </div>
  );
};
