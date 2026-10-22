import React, { useState } from 'react';
import { validatePilotSubmission } from '../game/rules';
import { LeaderboardEntry, RocketConfig } from '../game/types';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  squads: string[];
  activeSquadFilter: string;
  onSelectSquadFilter: (squad: string) => void;
  currentBestScore: number;
  currentRocketConfig: RocketConfig;
  onSubmitQuickScore: (
    callsign: string,
    squadCode: string,
  ) => Promise<{ ok: boolean; error?: string; rank?: number }>;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  entries,
  squads,
  activeSquadFilter,
  onSelectSquadFilter,
  currentBestScore,
  onSubmitQuickScore,
}) => {
  const [callsign, setCallsign] = useState('');
  const [squadCode, setSquadCode] = useState('SPACENET');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleRegisterScore = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const validation = validatePilotSubmission(callsign, squadCode);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Please enter a valid callsign.');
      return;
    }

    setSubmitting(true);
    const res = await onSubmitQuickScore(
      validation.normalizedCallsign,
      validation.normalizedSquad,
    );
    setSubmitting(false);

    if (!res.ok) {
      setErrorMsg(res.error || 'Submission failed.');
    } else {
      setSuccessMsg(
        `Registered ${validation.normalizedCallsign} (${validation.normalizedSquad}) at Rank #${res.rank}!`,
      );
      setCallsign('');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/80 pointer-events-auto"
    >
      <div className="w-full max-w-2xl pixel-panel rounded-lg p-5 sm:p-6 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h2
              id="leaderboard-modal-title"
              className="font-display text-xl sm:text-2xl font-bold text-white"
            >
              SpaceNet Global Orbital Leaderboard
            </h2>
            <p className="text-xs text-slate-400">
              Compete with friends using shared Squad Codes · Live telemetry rankings
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Global Leaderboard"
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium rounded border border-slate-700 cursor-pointer whitespace-nowrap shrink-0"
          >
            Close [Esc]
          </button>
        </div>

        {/* Squad Filter Segmented Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded border border-slate-800">
            <button
              type="button"
              onClick={() => onSelectSquadFilter('ALL')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSquadFilter === 'ALL'
                  ? 'bg-[#1488B8] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Global Pilots
            </button>
            {squads.slice(0, 5).map((sq) => (
              <button
                key={sq}
                type="button"
                onClick={() => onSelectSquadFilter(sq)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeSquadFilter === sq
                    ? 'bg-[#1488B8] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Squad: {sq}
              </button>
            ))}
          </div>

          <div className="text-xs font-mono-tabular text-slate-400">
            Session Best: <strong className="text-amber-400">{currentBestScore} pts</strong>
          </div>
        </div>

        {/* Standings Table */}
        <div className="flex-1 overflow-y-auto border border-slate-800 rounded bg-slate-950/90 mb-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 bg-slate-900/80">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Pilot Callsign</th>
                <th className="py-2.5 px-3">Squad</th>
                <th className="py-2.5 px-3">Rocket Spec</th>
                <th className="py-2.5 px-3 text-right">Peak Alt</th>
                <th className="py-2.5 px-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No orbital telemetry records found for this squad filter.
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => (
                  <tr key={entry.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono-tabular font-bold text-slate-300">
                      #{idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {entry.callsign}
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular text-[#38BDF8]">
                      {entry.squadCode}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {entry.rocketConfig.noseCone.replace('_', ' ')} ·{' '}
                      {entry.rocketConfig.livery.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-300">
                      {entry.peakAltitude}m
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-amber-400">
                      {entry.score}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pilot Callsign & Friend Squad Registration Form */}
        <form
          onSubmit={handleRegisterScore}
          className="bg-slate-900/90 border border-slate-800 rounded p-3.5"
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
            <div className="flex-1">
              <label
                htmlFor="lb-callsign-input"
                className="block text-[11px] font-medium text-slate-300 mb-1"
              >
                Pilot Callsign (2–16 chars)
              </label>
              <input
                id="lb-callsign-input"
                type="text"
                maxLength={16}
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="Enter Callsign (e.g. NOVA_99)"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono-tabular text-white focus:outline-none focus:border-[#38BDF8]"
              />
            </div>

            <div className="w-full sm:w-40">
              <label
                htmlFor="lb-squad-input"
                className="block text-[11px] font-medium text-slate-300 mb-1"
              >
                Friend Squad Code
              </label>
              <input
                id="lb-squad-input"
                type="text"
                maxLength={12}
                value={squadCode}
                onChange={(e) => setSquadCode(e.target.value)}
                placeholder="SPACENET"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono-tabular text-white focus:outline-none focus:border-[#38BDF8]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#1488B8] hover:bg-[#0EA5E9] text-white font-display font-bold text-xs rounded border border-[#38BDF8] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {submitting ? 'Posting...' : 'Post Pilot Record'}
            </button>
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs text-rose-400 mt-2">
              {errorMsg}
            </p>
          )}
          {successMsg && (
            <p role="status" className="text-xs text-emerald-400 mt-2">
              {successMsg}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
