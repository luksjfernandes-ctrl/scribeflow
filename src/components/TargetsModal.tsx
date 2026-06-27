import React from 'react';
import { X, Target as TargetIcon } from 'lucide-react';
import { ProjectSettings } from '../types';

interface TargetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProjectSettings;
  projectWords: number;
  sessionWords: number;
  onUpdateSettings: (settings: Partial<ProjectSettings>) => void;
}

const ProgressBar = ({ value, target }: { value: number; target: number }) => {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const done = pct >= 100;
  return (
    <div>
      <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: done ? '#40A040' : '#5B7A3D' }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span className="font-mono">
          {value.toLocaleString()} / {target.toLocaleString()} words
        </span>
        <span className={done ? 'text-[#5BBA4D] font-bold' : 'text-gray-400'}>{pct}%</span>
      </div>
    </div>
  );
};

const toDateInput = (ts: number | null): string => {
  if (!ts) return '';
  const d = new Date(ts);
  const off = d.getTimezoneOffset();
  return new Date(ts - off * 60000).toISOString().slice(0, 10);
};

export function TargetsModal({
  isOpen,
  onClose,
  settings,
  projectWords,
  sessionWords,
  onUpdateSettings,
}: TargetsModalProps) {
  if (!isOpen) return null;

  const remaining = Math.max(0, settings.target_word_count - projectWords);
  let deadlineInfo: { days: number; perDay: number } | null = null;
  if (settings.deadline) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.max(0, Math.ceil((settings.deadline - today.getTime()) / msPerDay));
    deadlineInfo = { days, perDay: days > 0 ? Math.ceil(remaining / days) : remaining };
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose}>
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl z-[101] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#333] bg-[#222]">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
            <TargetIcon size={18} className="text-[#5B7A3D]" /> Project Targets
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[#333] rounded-md transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 bg-[#1a1a1a] space-y-6">
          {/* Manuscript target */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Manuscript</span>
              <input
                type="number"
                min={0}
                className="w-28 bg-[#222] border border-[#333] rounded-md px-2 py-1 text-sm text-gray-200 text-right focus:outline-none focus:border-[#5B7A3D]"
                value={settings.target_word_count}
                onChange={(e) => onUpdateSettings({ target_word_count: parseInt(e.target.value) || 0 })}
              />
            </div>
            <ProgressBar value={projectWords} target={settings.target_word_count} />
          </div>

          {/* Session target */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">This Session</span>
              <input
                type="number"
                min={0}
                className="w-28 bg-[#222] border border-[#333] rounded-md px-2 py-1 text-sm text-gray-200 text-right focus:outline-none focus:border-[#5B7A3D]"
                value={settings.session_target}
                onChange={(e) => onUpdateSettings({ session_target: parseInt(e.target.value) || 0 })}
              />
            </div>
            <ProgressBar value={sessionWords} target={settings.session_target} />
          </div>

          {/* Deadline */}
          <div className="space-y-2 pt-2 border-t border-[#2a2a2a]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Deadline</span>
              <input
                type="date"
                className="bg-[#222] border border-[#333] rounded-md px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-[#5B7A3D] [color-scheme:dark]"
                value={toDateInput(settings.deadline)}
                onChange={(e) =>
                  onUpdateSettings({
                    deadline: e.target.value ? new Date(`${e.target.value}T00:00:00`).getTime() : null,
                  })
                }
              />
            </div>
            {deadlineInfo && (
              <div className="flex items-center justify-between text-sm text-gray-300">
                <span>
                  {deadlineInfo.days} day{deadlineInfo.days === 1 ? '' : 's'} left
                </span>
                <span className="text-gray-400">
                  {remaining > 0 ? (
                    <>
                      <span className="font-bold text-[#7DA861]">{deadlineInfo.perDay.toLocaleString()}</span> words/day
                    </>
                  ) : (
                    <span className="font-bold text-[#5BBA4D]">Target reached 🎉</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-[#222] border-t border-[#333] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
