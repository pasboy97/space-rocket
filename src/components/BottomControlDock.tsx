import React from 'react';
import {
  CameraPreset,
  FinType,
  HullLiveryType,
  NoseConeType,
  PlumeType,
  RocketConfig,
} from '../game/types';

interface BottomControlDockProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  rocketConfig: RocketConfig;
  onChangeConfig: (cfg: RocketConfig) => void;
  cameraPreset: CameraPreset;
  onChangeCamera: (preset: CameraPreset) => void;
  explodedRatio: number;
  onChangeExploded: (val: number) => void;
}

const CAMERA_PRESETS: Array<{ id: CameraPreset; label: string }> = [
  { id: 'chase', label: 'Chase Cam' },
  { id: 'arcade_ortho', label: 'Wide Arcade' },
  { id: 'cockpit', label: 'Nose Cam' },
  { id: 'turntable', label: 'Orbit Inspect' },
];

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  collapsed,
  onToggleCollapsed,
  rocketConfig,
  onChangeConfig,
  cameraPreset,
  onChangeCamera,
  explodedRatio,
  onChangeExploded,
}) => {
  const cycleNose = () => {
    const order: NoseConeType[] = ['aerospike', 'capsule', 'voxel_command'];
    const next = order[(order.indexOf(rocketConfig.noseCone) + 1) % order.length];
    onChangeConfig({ ...rocketConfig, noseCone: next });
  };

  const cycleLivery = () => {
    const order: HullLiveryType[] = [
      'spacenet_cyan',
      'retro_arcade',
      'solar_gold',
      'stealth_obsidian',
    ];
    const next = order[(order.indexOf(rocketConfig.livery) + 1) % order.length];
    onChangeConfig({ ...rocketConfig, livery: next });
  };

  const cycleFins = () => {
    const order: FinType[] = ['delta_swept', 'grid_fins', 'twin_boosters'];
    const next = order[(order.indexOf(rocketConfig.fins) + 1) % order.length];
    onChangeConfig({ ...rocketConfig, fins: next });
  };

  const cyclePlume = () => {
    const order: PlumeType[] = ['ion_cyan', 'plasma_amber', 'hyper_magenta'];
    const next = order[(order.indexOf(rocketConfig.plume) + 1) % order.length];
    onChangeConfig({ ...rocketConfig, plume: next });
  };

  return (
    <div
      className="fixed bottom-2.5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center"
      style={{ maxWidth: 'min(920px, 94vw)', width: '100%' }}
    >
      {/* Collapse / Expand Drawer Handle with Inline SVG Chevron (No missing unicode glyphs) */}
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => {
          e.currentTarget.blur();
          onToggleCollapsed();
        }}
        className="flex items-center gap-1.5 px-3.5 py-1 pixel-panel rounded-t-md text-xs font-mono-tabular font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        <svg
          viewBox="0 0 24 24"
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          {collapsed ? (
            <polyline points="18 15 12 9 6 15" />
          ) : (
            <polyline points="6 9 12 15 18 9" />
          )}
        </svg>
        <span>{collapsed ? 'Show Hangar & Camera Controls [H]' : 'Hide Controls [H]'}</span>
      </button>

      {!collapsed && (
        <div className="w-full pixel-panel rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          {/* Quick Live Modular Ship Switchers */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                cycleNose();
              }}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Nose: <span className="text-[#38BDF8]">{rocketConfig.noseCone.replace('_', ' ')}</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                cycleLivery();
              }}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Livery: <span className="text-[#38BDF8]">{rocketConfig.livery.replace('_', ' ')}</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                cycleFins();
              }}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Fins: <span className="text-[#38BDF8]">{rocketConfig.fins.replace('_', ' ')}</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                cyclePlume();
              }}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Plume: <span className="text-amber-400">{rocketConfig.plume.replace('_', ' ')}</span>
            </button>
          </div>

          {/* Exploded Assembly Slider */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="exploded-slider"
              className="text-xs font-medium text-slate-300 whitespace-nowrap shrink-0"
            >
              Explode Assembly
            </label>
            <input
              id="exploded-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={explodedRatio}
              onChange={(e) => onChangeExploded(parseFloat(e.target.value))}
              className="w-20 sm:w-24 accent-[#0EA5E9] cursor-pointer"
            />
          </div>

          {/* Camera View Preset Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800 overflow-x-auto max-w-full">
            {CAMERA_PRESETS.map((cam) => (
              <button
                key={cam.id}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onChangeCamera(cam.id);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cameraPreset === cam.id
                    ? 'bg-[#1488B8] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
