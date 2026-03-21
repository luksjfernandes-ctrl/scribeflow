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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose}>
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl z-[101] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#333] bg-[#222]">
          <h2 className="text-lg font-semibold text-gray-100">Compile & Export</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#333] rounded-md transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 bg-[#1a1a1a]">
          <p className="text-sm text-gray-400 mb-4">Selecione um formato para exportar seu manuscrito. Todos os documentos marcados para inclusão serão processados.</p>
          
          <div className="grid grid-cols-1 gap-2">
            {formats.map((format) => (
              <button
                key={format.id}
                onClick={() => { onExport(format.id); onClose(); }}
                className="flex items-center gap-4 p-3 border border-[#333] rounded-lg hover:bg-blue-600/10 hover:border-blue-500 transition-all text-left bg-[#222]"
              >
                <div className="w-10 h-10 bg-[#1a1a1a] rounded flex items-center justify-center shadow-sm border border-[#333]">
                  {format.icon}
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-200">{format.name}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">{format.ext}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-[#222] border-t border-[#333] flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
