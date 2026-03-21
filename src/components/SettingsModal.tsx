import React from 'react';
import { X } from 'lucide-react';
import { ProjectSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProjectSettings;
  onUpdateSettings: (settings: Partial<ProjectSettings>) => void;
}

export function SettingsModal({ isOpen, onClose, settings, onUpdateSettings }: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose}>
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl z-[101] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#333] bg-[#222]">
          <h2 className="text-lg font-semibold text-gray-100">Project Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#333] rounded-md transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 bg-[#1a1a1a] space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Theme</span>
            <select 
              className="bg-[#222] border border-[#333] rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-[#5B7A3D]"
              value={settings.theme}
              onChange={(e) => onUpdateSettings({ theme: e.target.value as any })}
            >
              <option value="traditional">Traditional (Light)</option>
              <option value="dark">Dark Mode</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Target Word Count</span>
            <input 
              type="number" 
              className="w-24 bg-[#222] border border-[#333] rounded-md px-2 py-1.5 text-sm text-gray-200 text-right focus:outline-none focus:border-[#5B7A3D]"
              value={settings.target_word_count}
              onChange={(e) => onUpdateSettings({ target_word_count: parseInt(e.target.value) || 0 })}
            />
          </div>
          
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">SESSION TARGET</div>
            <input 
              type="number" 
              className="w-full bg-[#222] border border-[#333] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#5B7A3D]"
              value={settings.session_target}
              onChange={(e) => onUpdateSettings({ session_target: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">PAPER WIDTH (PX)</div>
            <input 
              type="number" 
              className="w-full bg-[#222] border border-[#333] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#5B7A3D]"
              value={settings.paper_width}
              onChange={(e) => onUpdateSettings({ paper_width: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="p-4 bg-[#222] border-t border-[#333] flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors">Concluir</button>
        </div>
      </div>
    </div>
  );
}
