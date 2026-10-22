import React, { useState } from 'react';
import { computeRocketStats } from '../game/rules';
import {
  FinType,
  HullLiveryType,
  LeaderboardEntry,
  NoseConeType,
  PlumeType,
  RocketConfig,
} from '../game/types';

interface TitleScreenProps {
  rocketConfig: RocketConfig;
  onChangeConfig: (cfg: RocketConfig) => void;
  onStartGame: () => void;
  onOpenLeaderboard: () => void;
  topPilots: LeaderboardEntry[];
}

const NOSE_OPTIONS: Array<{ id: NoseConeType; label: string; clue: string }> = [
  { id: 'aerospike', label: 'Aero Spike', clue: '+Thrust · +Radar' },
  { id: 'capsule', label: 'Orbital Capsule', clue: '+1 Hull Armor · +Stability' },
  { id: 'voxel_command', label: 'Voxel Command', clue: '+Fuel Tank · +Torque' },
];

const LIVERY_OPTIONS: Array<{ id: HullLiveryType; label: string; swatch: string }> = [
  { id: 'spacenet_cyan', label: 'SpaceNet Cyan', swatch: '#1488B8' },
  { id: 'retro_arcade', label: 'Retro Red-White', swatch: '#DC2626' },
  { id: 'solar_gold', label: 'Solar Sovereign', swatch: '#F59E0B' },
  { id: 'stealth_obsidian', label: 'Stealth Obsidian', swatch: '#38BDF8' },
];

const FIN_OPTIONS: Array<{ id: FinType; label: string; clue: string }> = [
  { id: 'delta_swept', label: 'Delta Swept', clue: 'Balanced Aero' },
  { id: 'grid_fins', label: 'Quad Grid Fins', clue: 'Max Gimbal Torque' },
  { id: 'twin_boosters', label: 'Twin Boosters', clue: 'Heavy Lift +Fuel' },
];

const PLUME_OPTIONS: Array<{ id: PlumeType; label: string; swatch: string }> = [
  { id: 'ion_cyan', label: 'Ion Cyan', swatch: '#0EA5E9' },
  { id: 'plasma_amber', label: 'Plasma Amber', swatch: '#F59E0B' },
  { id: 'hyper_magenta', label: 'Hyper Magenta', swatch: '#EC4899' },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  rocketConfig,
  onChangeConfig,
  onStartGame,
  onOpenLeaderboard,
  topPilots,
}) => {
  const [logoImgFailed, setLogoImgFailed] = useState(false);
  const stats = computeRocketStats(rocketConfig);

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-7">
      {/* Top Row: SpaceNet Brand Identity Lockup (Left) + Global Leaderboard Preview (Right) */}
      <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
        {/* Left Focal Region: Bespoke SVG Emblem + SpaceNet Mediatama Lockup */}
        <div className="pointer-events-auto max-w-xl pixel-panel rounded-lg p-5 sm:p-6">
          <div className="flex items-center gap-3.5 mb-3">
            {/* Custom Inline SVG SpaceNet Orbital Rocket Emblem */}
            <svg
              viewBox="0 0 64 64"
              className="w-12 h-12 shrink-0"
              aria-hidden="true"
            >
              <circle
                cx="32"
                cy="32"
                r="24"
                fill="none"
                stroke="#1488B8"
                strokeWidth="6"
                strokeDasharray="115 36"
                strokeDashoffset="20"
              />
              <path
                d="M18 46 L26 38 L48 12 L52 16 L26 38 Z"
                fill="#F8FAFC"
              />
              <polygon points="24,36 52,12 46,24 28,40" fill="#38BDF8" />
              <polygon points="18,40 24,36 22,42" fill="#1488B8" />
              <polygon points="28,46 24,42 28,40" fill="#1488B8" />
              <polygon points="12,52 21,43 24,46" fill="#0EA5E9" />
            </svg>

            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white"
                  style={{ textWrap: 'balance' }}
                >
                  SPACENET <span className="text-[#1488B8]">ORBITAL</span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 tracking-wide">
                PT. Space Network Mediatama · Retro-Pixel Orbital Flight Simulator
              </p>
            </div>

            {!logoImgFailed && (
              <div className="ml-auto hidden sm:flex items-center bg-white rounded px-2.5 py-1 border border-slate-300 shrink-0">
                <img
                  src="/assets/aistudio/WhatsApp_Image_2026-10-22_at_14.24.39_f7e781f5.jpeg"
                  alt="SpaceNet PT. Space Network Mediatama Official Mark"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoImgFailed(true)}
                  className="h-7 w-auto object-contain"
                />
              </div>
            )}
          </div>

          <p className="text-sm text-slate-300 leading-relaxed mb-4">
            Pilot your modular retro-pixel rocket from Complex 01 through three orbital
            relay stages to the Mediatama Geostationary Core. Sync telemetry rings, master
            soft pad touchdowns to refuel, and compete on the live Global Leaderboard.
          </p>

          {/* Compact Modular Hangar Customizer */}
          <div className="space-y-3 border-t border-slate-800 pt-3.5 mb-4">
            {/* Nose Cone Selector */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span className="font-semibold text-slate-200">Nose Cone Module</span>
                <span className="font-mono-tabular text-[#38BDF8]">
                  {NOSE_OPTIONS.find((n) => n.id === rocketConfig.noseCone)?.clue}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {NOSE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeConfig({ ...rocketConfig, noseCone: opt.id })}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 truncate ${
                      rocketConfig.noseCone === opt.id
                        ? 'bg-[#1488B8] text-white border-[#38BDF8]'
                        : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fin & Booster Selector */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span className="font-semibold text-slate-200">Fin &amp; Booster Stage</span>
                <span className="font-mono-tabular text-[#38BDF8]">
                  {FIN_OPTIONS.find((f) => f.id === rocketConfig.fins)?.clue}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {FIN_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeConfig({ ...rocketConfig, fins: opt.id })}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 truncate ${
                      rocketConfig.fins === opt.id
                        ? 'bg-[#1488B8] text-white border-[#38BDF8]'
                        : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hull Livery & Plume Rows (Full-Width to prevent label truncation) */}
            <div className="space-y-2.5">
              <div>
                <span className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Pixel Hull Livery
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {LIVERY_OPTIONS.map((liv) => (
                    <button
                      key={liv.id}
                      type="button"
                      onClick={() => onChangeConfig({ ...rocketConfig, livery: liv.id })}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                        rocketConfig.livery === liv.id
                          ? 'bg-slate-800 text-white border-[#38BDF8]'
                          : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: liv.swatch }}
                      />
                      <span>{liv.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Thruster Plume Core
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {PLUME_OPTIONS.map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => onChangeConfig({ ...rocketConfig, plume: pl.id })}
                      className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                        rocketConfig.plume === pl.id
                          ? 'bg-slate-800 text-white border-[#38BDF8]'
                          : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: pl.swatch }}
                      />
                      <span>{pl.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live Calculated Ship Telemetry Strip */}
          <div className="grid grid-cols-4 gap-2 py-2.5 px-3 bg-slate-950/90 rounded border border-slate-800/90 mb-4 text-center">
            <div>
              <div className="text-[11px] text-slate-400">Thrust</div>
              <div className="font-mono-tabular text-sm font-bold text-white">
                {Math.round(stats.maxThrust)} m/s²
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Propellant</div>
              <div className="font-mono-tabular text-sm font-bold text-[#38BDF8]">
                {stats.fuelCapacity} L
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">RCS Torque</div>
              <div className="font-mono-tabular text-sm font-bold text-amber-400">
                {stats.rcsTorque.toFixed(1)} rad
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Hull Armor</div>
              <div className="font-mono-tabular text-sm font-bold text-emerald-400">
                {stats.maxHullHp} Pips
              </div>
            </div>
          </div>

          {/* Primary Start CTA & Secondary Leaderboard Action (<= 2 actions) */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onStartGame();
              }}
              className="flex-1 px-6 py-3 bg-[#1488B8] hover:bg-[#0EA5E9] text-white font-display font-bold text-base tracking-wide rounded border border-[#38BDF8] transition-transform active:translate-y-0.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              Launch Mission
            </button>

            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-100 font-medium text-sm rounded border border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Global Leaderboard
            </button>
          </div>
        </div>

        {/* Right Top: Compact Global Standings Preview Card */}
        <div className="pointer-events-auto hidden md:block w-80 pixel-panel rounded-lg p-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
            <h2 className="font-display text-sm font-bold text-white">
              Top Orbital Pilots
            </h2>
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="text-xs text-[#38BDF8] hover:underline whitespace-nowrap shrink-0"
            >
              View All Ranks
            </button>
          </div>

          <div className="space-y-2">
            {topPilots.slice(0, 4).map((entry, idx) => (
              <div
                key={entry.id}
                className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono-tabular font-bold text-slate-400 w-4">
                    {idx + 1}.
                  </span>
                  <span className="font-semibold text-slate-100 truncate">
                    {entry.callsign}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-[11px] text-[#38BDF8] truncate">
                    {entry.squadCode}
                  </span>
                </div>
                <span className="font-mono-tabular font-bold text-amber-400 ml-2 shrink-0">
                  {entry.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Safe Margin: Flat Single-Line Control Hint */}
      <div className="text-center pb-1">
        <p className="text-xs text-slate-300 font-mono-tabular tracking-wide">
          W / Space Main Thrust · A / D Gimbal Pitch · S Retro-Stabilize · Shift Impulse Boost · Esc Pause
        </p>
      </div>
    </div>
  );
};
