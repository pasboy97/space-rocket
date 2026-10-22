import React, { useState } from 'react';
import { validatePilotSubmission } from '../game/rules';
import { GameState, RunSnapshot } from '../game/types';

interface StatusModalProps {
  gameState: GameState;
  snapshot: RunSnapshot | null;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onOpenLeaderboard: () => void;
  onSubmitScore: (callsign: string, squadCode: string) => Promise<{ ok: boolean; error?: string; rank?: number }>;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  gameState,
  snapshot,
  onResume,
  onRestart,
  onReturnTitle,
  onOpenLeaderboard,
  onSubmitScore,
}) => {
  const [callsign, setCallsign] = useState('CMDR_PILOT');
  const [squadCode, setSquadCode] = useState('SPACENET');
  const [submitting, setSubmitting] = useState(false);
  const [submittedRank, setSubmittedRank] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (gameState !== 'paused' && gameState !== 'gameover') {
    return null;
  }

  const isPaused = gameState === 'paused';
  const isVictory = snapshot?.outcome === 'victory';

  const handleScoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const check = validatePilotSubmission(callsign, squadCode);
    if (!check.valid) {
      setFormError(check.error || 'Invalid callsign');
      return;
    }
    setSubmitting(true);
    const res = await onSubmitScore(check.normalizedCallsign, check.normalizedSquad);
    setSubmitting(false);
    if (!res.ok) {
      setFormError(res.error || 'Failed to submit score');
    } else {
      setSubmittedRank(res.rank ?? 1);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/75 pointer-events-auto"
    >
      <div
        className={`w-full max-w-md rounded-lg p-6 ${
          isVictory ? 'pixel-panel-amber' : 'pixel-panel'
        }`}
      >
        {isPaused ? (
          <>
            <h2
              id="status-modal-title"
              className="font-display text-2xl font-bold text-white mb-1"
            >
              Mission Paused
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              Orbital telemetry frozen. Adjust hangar modules below or resume flight.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResume}
                className="w-full py-2.5 px-4 bg-[#1488B8] hover:bg-[#0EA5E9] text-white font-display font-bold text-sm rounded border border-[#38BDF8] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Resume Flight
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-sm rounded border border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Restart Mission
              </button>
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-amber-400 font-medium text-sm rounded border border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Global Leaderboard
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 font-medium text-sm rounded border border-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Return to Launch Complex
              </button>
            </div>
          </>
        ) : (
          snapshot && (
            <>
              <div className="mb-4">
                <div className="text-xs font-mono-tabular font-semibold text-[#38BDF8] mb-0.5">
                  {isVictory ? 'ORBITAL CORE DOCKING COMPLETE' : 'TELEMETRY SIGNAL LOST'}
                </div>
                <h2
                  id="status-modal-title"
                  className={`font-display text-2xl sm:text-3xl font-bold ${
                    isVictory ? 'text-amber-400' : 'text-white'
                  }`}
                >
                  {isVictory ? 'Mission Accomplished' : 'Mission Aborted'}
                </h2>
                <p className="text-xs text-slate-300 mt-1">{snapshot.reason}</p>
              </div>

              {/* 3 Tabular-Nums Mastery / Progress Metric Tiles */}
              <div className="grid grid-cols-3 gap-2.5 mb-5">
                <div className="bg-slate-950/90 border border-slate-800 rounded p-2.5 text-center">
                  <div className="text-[10px] font-semibold text-slate-400">FINAL SCORE</div>
                  <div className="font-mono-tabular text-lg font-bold text-amber-400">
                    {snapshot.score}
                  </div>
                  <div className="text-[10px] font-mono-tabular text-slate-500">
                    Best {snapshot.bestScore}
                  </div>
                </div>

                <div className="bg-slate-950/90 border border-slate-800 rounded p-2.5 text-center">
                  <div className="text-[10px] font-semibold text-slate-400">PEAK ALTITUDE</div>
                  <div className="font-mono-tabular text-lg font-bold text-[#38BDF8]">
                    {snapshot.peakAltitude}m
                  </div>
                  <div className="text-[10px] font-mono-tabular text-slate-500">
                    Sector {snapshot.sectorReached}/4
                  </div>
                </div>

                <div className="bg-slate-950/90 border border-slate-800 rounded p-2.5 text-center">
                  <div className="text-[10px] font-semibold text-slate-400">
                    {isVictory ? 'CLEAR TIME' : 'RELAYS SYNCED'}
                  </div>
                  <div className="font-mono-tabular text-lg font-bold text-emerald-400">
                    {isVictory
                      ? `${snapshot.clearTimeSeconds}s`
                      : `${snapshot.ringsCollected}/${snapshot.totalRings}`}
                  </div>
                  <div className="text-[10px] font-mono-tabular text-slate-500">
                    Pads {snapshot.padsLanded}/4
                  </div>
                </div>
              </div>

              {/* Global Leaderboard Score Transmission Form */}
              {submittedRank === null ? (
                <form
                  onSubmit={handleScoreSubmit}
                  className="bg-slate-950/90 border border-slate-800 rounded p-3.5 mb-5 space-y-3"
                >
                  <div className="text-xs font-semibold text-slate-200">
                    Transmit Run to Global Leaderboard
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="pilot-callsign"
                        className="block text-[11px] text-slate-400 mb-1"
                      >
                        Pilot Callsign
                      </label>
                      <input
                        id="pilot-callsign"
                        type="text"
                        maxLength={16}
                        value={callsign}
                        onChange={(e) => setCallsign(e.target.value)}
                        placeholder="CMDR_AZAR"
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono-tabular text-white focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="pilot-squad"
                        className="block text-[11px] text-slate-400 mb-1"
                      >
                        Friend Squad Code
                      </label>
                      <input
                        id="pilot-squad"
                        type="text"
                        maxLength={12}
                        value={squadCode}
                        onChange={(e) => setSquadCode(e.target.value)}
                        placeholder="SPACENET"
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono-tabular text-white focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>
                  </div>

                  {formError && (
                    <p role="alert" className="text-xs text-rose-400">
                      {formError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-display font-bold text-xs rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {submitting ? 'Transmitting Telemetry...' : 'Post Score to Leaderboard'}
                  </button>
                </form>
              ) : (
                <div className="bg-emerald-950/60 border border-emerald-500/50 rounded p-3 mb-5 text-center">
                  <p className="text-xs font-semibold text-emerald-300">
                    Telemetry Confirmed · Global Rank #{submittedRank}
                  </p>
                  <button
                    type="button"
                    onClick={onOpenLeaderboard}
                    className="mt-1.5 text-xs text-[#38BDF8] hover:underline"
                  >
                    Inspect Full Global Standings
                  </button>
                </div>
              )}

              {/* Outcome Modal Actions */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  data-start="true"
                  onClick={() => {
                    setSubmittedRank(null);
                    onRestart();
                  }}
                  className="flex-1 py-2.5 px-4 bg-[#1488B8] hover:bg-[#0EA5E9] text-white font-display font-bold text-sm rounded border border-[#38BDF8] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isVictory ? 'Fly Next Sortie' : 'Try Again'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSubmittedRank(null);
                    onReturnTitle();
                  }}
                  className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium text-sm rounded border border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Title Screen
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
};
