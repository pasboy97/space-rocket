/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomControlDock } from './components/BottomControlDock';
import { LeaderboardModal } from './components/LeaderboardModal';
import { PlayingHud } from './components/PlayingHud';
import { HudTelemetryPayload, RocketViewport3D } from './components/RocketViewport3D';
import { StatusModal } from './components/StatusModal';
import { TitleScreen } from './components/TitleScreen';
import { soundEngine } from './game/audio';
import {
  DEFAULT_ROCKET_CONFIG,
  computeRocketStats,
  createInitialPhysicsState,
} from './game/rules';
import {
  CameraPreset,
  GameState,
  LeaderboardEntry,
  RocketConfig,
  RunSnapshot,
} from './game/types';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'playing';
      }
    }
    return 'title';
  });

  const [rocketConfig, setRocketConfig] = useState<RocketConfig>(DEFAULT_ROCKET_CONFIG);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('chase');
  const [explodedRatio, setExplodedRatio] = useState<number>(0);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [resetSignal, setResetSignal] = useState<number>(0);

  const [bestScore, setBestScore] = useState<number>(1250);
  const [runSnapshot, setRunSnapshot] = useState<RunSnapshot | null>(null);

  const [leaderboardOpen, setLeaderboardOpen] = useState<boolean>(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [availableSquads, setAvailableSquads] = useState<string[]>(['SPACENET', 'ORBIT-88']);
  const [squadFilter, setSquadFilter] = useState<string>('ALL');

  const [telemetry, setTelemetry] = useState<HudTelemetryPayload>(() => ({
    physics: createInitialPhysicsState(computeRocketStats(DEFAULT_ROCKET_CONFIG)),
    score: 0,
    combo: 1,
    sector: 1,
    ringsCollected: 0,
    totalRings: 9,
    padsLanded: 1,
    nearestPad: null,
    statusBanner: null,
  }));

  const touchInputRef = useRef({
    thrust: false,
    retro: false,
    left: false,
    right: false,
    boost: false,
  });

  // Sync game state to document.body.dataset.state per game shell contract
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const fetchLeaderboard = useCallback(async (squad: string = 'ALL') => {
    try {
      const res = await fetch(`/api/leaderboard?squad=${encodeURIComponent(squad)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.entries)) {
        setLeaderboardEntries(data.entries);
      }
      if (Array.isArray(data.squads)) {
        setAvailableSquads(data.squads);
      }
    } catch {
      // Keep existing local entries if offline
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(squadFilter);
  }, [fetchLeaderboard, squadFilter]);

  const startMission = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setDockCollapsed(true);
    }
    setExplodedRatio(0);
    setRunSnapshot(null);
    setResetSignal((prev) => prev + 1);
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, []);

  const handleRunFinished = useCallback((snapshot: RunSnapshot) => {
    setBestScore((prev) => Math.max(prev, snapshot.score));
    setRunSnapshot(snapshot);
    document.body.dataset.state = 'gameover';
    setGameState('gameover');
  }, []);

  const handleCycleCamera = useCallback(() => {
    const order: CameraPreset[] = ['chase', 'arcade_ortho', 'cockpit', 'turntable'];
    setCameraPreset((prev) => order[(order.indexOf(prev) + 1) % order.length]);
  }, []);

  const handleToggleMute = useCallback(() => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleSubmitScore = useCallback(
    async (callsign: string, squadCode: string) => {
      const scoreToSubmit = Math.max(
        runSnapshot?.score ?? telemetry.score,
        bestScore,
      );
      const peakAltToSubmit = runSnapshot?.peakAltitude ?? Math.round(telemetry.physics.peakAltitude);
      try {
        const res = await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callsign,
            squadCode,
            score: scoreToSubmit,
            peakAltitude: peakAltToSubmit,
            padsLanded: runSnapshot?.padsLanded ?? telemetry.padsLanded,
            ringsCollected: runSnapshot?.ringsCollected ?? telemetry.ringsCollected,
            outcome: runSnapshot?.outcome ?? 'defeat',
            rocketConfig,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error || 'Submission rejected' };
        }
        await fetchLeaderboard(squadFilter);
        return { ok: true, rank: data.rank };
      } catch {
        return { ok: false, error: 'Network error while transmitting telemetry' };
      }
    },
    [bestScore, fetchLeaderboard, rocketConfig, runSnapshot, squadFilter, telemetry],
  );

  // Global Keyboard Shortcuts for Title Start, Pause, Mute, Camera, Dock, and Restart
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (leaderboardOpen) {
        if (e.code === 'Escape') {
          setLeaderboardOpen(false);
        }
        return;
      }

      if (gameState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startMission();
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        setGameState((prev) => {
          if (prev === 'playing') return 'paused';
          if (prev === 'paused') return 'playing';
          return prev;
        });
      } else if (e.code === 'KeyM') {
        handleToggleMute();
      } else if (e.code === 'KeyC') {
        handleCycleCamera();
      } else if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      } else if (e.code === 'KeyL') {
        setLeaderboardOpen((prev) => !prev);
      } else if (e.code === 'KeyR' && (gameState === 'playing' || gameState === 'paused')) {
        startMission();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, handleCycleCamera, handleToggleMute, leaderboardOpen, startMission]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#060B14] select-none">
      {/* Isolated Full-Viewport 3D WebGL Scene */}
      <RocketViewport3D
        gameState={gameState}
        rocketConfig={rocketConfig}
        cameraPreset={cameraPreset}
        explodedRatio={explodedRatio}
        bestScore={bestScore}
        touchInputRef={touchInputRef}
        resetSignal={resetSignal}
        onTelemetryUpdate={setTelemetry}
        onRunFinished={handleRunFinished}
      />

      {/* Title Screen Stage Overlay */}
      {gameState === 'title' && (
        <TitleScreen
          rocketConfig={rocketConfig}
          onChangeConfig={setRocketConfig}
          onStartGame={startMission}
          onOpenLeaderboard={() => setLeaderboardOpen(true)}
          topPilots={leaderboardEntries}
        />
      )}

      {/* Active Flight HUD & Collapsible Bottom Hangar Dock */}
      {gameState !== 'title' && (
        <>
          <PlayingHud
            telemetry={telemetry}
            bestScore={bestScore}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onCycleCamera={handleCycleCamera}
            onOpenLeaderboard={() => setLeaderboardOpen(true)}
            onTogglePause={() =>
              setGameState((prev) => (prev === 'playing' ? 'paused' : 'playing'))
            }
            onRestart={startMission}
            touchInputRef={touchInputRef}
          />

          <BottomControlDock
            collapsed={dockCollapsed}
            onToggleCollapsed={() => setDockCollapsed((prev) => !prev)}
            rocketConfig={rocketConfig}
            onChangeConfig={setRocketConfig}
            cameraPreset={cameraPreset}
            onChangeCamera={setCameraPreset}
            explodedRatio={explodedRatio}
            onChangeExploded={setExplodedRatio}
          />
        </>
      )}

      {/* Pause / Victory / Defeat Status Modal */}
      <StatusModal
        gameState={gameState}
        snapshot={runSnapshot}
        onResume={() => setGameState('playing')}
        onRestart={startMission}
        onReturnTitle={() => {
          soundEngine.stopThrusterLoop();
          setGameState('title');
        }}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
        onSubmitScore={handleSubmitScore}
      />

      {/* Global Leaderboard Modal */}
      <LeaderboardModal
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        entries={leaderboardEntries}
        squads={availableSquads}
        activeSquadFilter={squadFilter}
        onSelectSquadFilter={setSquadFilter}
        currentBestScore={bestScore}
        currentRocketConfig={rocketConfig}
        onSubmitQuickScore={handleSubmitScore}
      />
    </main>
  );
}
