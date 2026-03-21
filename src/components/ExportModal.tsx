import React from 'react';
import { X, FileText, Download, FileCode, FileType } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: string) => void;
}

export function ExportModal({ isOpen, onClose, onExport }: ExportModalProps) {
  if (!isOpen) return null;

  const formats = [
    { id: 'pdf', name: 'PDF Document', icon: <FileText size={20} className="text-red-500" />, ext: '.pdf' },
    { id: 'docx', name: 'Microsoft Word', icon: <FileType size={20} className="text-blue-500" />, ext: '.docx' },
    { id: 'rtf', name: 'Rich Text Format', icon: <FileCode size={20} className="text-gray-500" />, ext: '.rtf' },
    { id: 'epub', name: 'ePub eBook', icon: <Download size={20} className="text-green-500" />, ext: '.epub' },
    { id: 'txt', name: 'Plain Text', icon: <FileText size={20} className="text-gray-400" />, ext: '.txt' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-sm font-bold">Compile & Export</h2>
          <button onClick={onClose} className="p-1 hover:bg-black/5 rounded">
            <X size={16} />
          </button>
        </div>
        
        <div className="modal-body">
          <p className="text-xs text-[#5A5A5A] mb-4">Select a format to export your manuscript. This will compile all documents marked for inclusion.</p>
          
          <div className="grid grid-cols-1 gap-2">
            {formats.map((format) => (
              <button
                key={format.id}
                onClick={() => onExport(format.id)}
                className="flex items-center gap-4 p-3 border border-[#B5B2AA] rounded-lg hover:bg-[#5B7A3D]/10 hover:border-[#5B7A3D] transition-all text-left"
              >
                <div className="w-10 h-10 bg-white rounded flex items-center justify-center shadow-sm border border-[#B5B2AA]/30">
                  {format.icon}
                </div>
                <div>
                  <div className="text-sm font-bold">{format.name}</div>
                  <div className="text-[10px] text-[#5A5A5A] uppercase tracking-wider">{format.ext}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
