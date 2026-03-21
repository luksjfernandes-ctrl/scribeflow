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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-sm font-bold">Project Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-black/5 rounded">
            <X size={16} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="settings-row">
            <span className="settings-label">Theme</span>
            <select 
              className="settings-control bg-white border border-[#B5B2AA] rounded px-2 py-1"
              value={settings.theme}
              onChange={(e) => onUpdateSettings({ theme: e.target.value as any })}
            >
              <option value="traditional">Traditional (Light)</option>
              <option value="dark">Dark Mode</option>
            </select>
          </div>

          <div className="settings-row">
            <span className="settings-label">Target Word Count</span>
            <input 
              type="number" 
              className="inspector-dropdown"
              value={settings.target_word_count}
              onChange={(e) => onUpdateSettings({ target_word_count: parseInt(e.target.value) || 0 })}
            />
          </div>
          
          <div className="space-y-1">
            <div className="inspector-section-header">SESSION TARGET</div>
            <input 
              type="number" 
              className="inspector-dropdown"
              value={settings.session_target}
              onChange={(e) => onUpdateSettings({ session_target: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-1">
            <div className="inspector-section-header">PAPER WIDTH (PX)</div>
            <input 
              type="number" 
              className="inspector-dropdown"
              value={settings.paper_width}
              onChange={(e) => onUpdateSettings({ paper_width: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary">Done</button>
        </div>
      </div>
    </div>
  );
}
