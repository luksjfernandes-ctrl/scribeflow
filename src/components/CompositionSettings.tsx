import React, { useState, useRef, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CompositionPrefs } from '../hooks/useCompositionPrefs';
import { cn } from '../lib/utils';

interface CompositionSettingsProps {
  prefs: CompositionPrefs;
  onUpdate: (prefs: Partial<CompositionPrefs>) => void;
}

export function CompositionSettings({ prefs, onUpdate }: CompositionSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const FONTS = [
    { label: 'Serif (Santuário)', value: 'serif' },
    { label: 'Sans-serif (Moderno)', value: 'system-ui' },
    { label: 'Monospaced (Draft)', value: 'monospace' },
  ];

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-3 rounded-full transition-all duration-300 shadow-lg",
          isOpen ? "bg-[#B8A04A] text-black" : "bg-white/5 text-gray-500 hover:text-white/80 hover:bg-white/10 opacity-20 hover:opacity-80"
        )}
      >
        <Settings size={22} className={cn(isOpen && "animate-spin-slow")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-16 right-0 w-80 bg-[#1A1A1A] border border-[#333] rounded-2xl shadow-2xl p-6 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Configurações de Foco</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-600 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-8">
              {/* Paper Width */}
              <div className="space-y-3">
                <div className="flex justify-between text-[11px] font-mono uppercase tracking-widest text-gray-400">
                  <span>Largura do Texto</span>
                  <span className="text-[#B8A04A] font-bold">{prefs.paperWidth}px</span>
                </div>
                <input 
                  type="range"
                  min="500"
                  max="900"
                  value={prefs.paperWidth}
                  onChange={(e) => onUpdate({ paperWidth: Number(e.target.value) })}
                  className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[#B8A04A]"
                />
              </div>

              {/* Font Size */}
              <div className="space-y-3">
                <div className="flex justify-between text-[11px] font-mono uppercase tracking-widest text-gray-400">
                  <span>Tamanho da Fonte</span>
                  <span className="text-[#B8A04A] font-bold">{prefs.fontSize}px</span>
                </div>
                <input 
                  type="range"
                  min="14"
                  max="24"
                  value={prefs.fontSize}
                  onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
                  className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[#B8A04A]"
                />
              </div>

              {/* Line Height */}
              <div className="space-y-3">
                <div className="flex justify-between text-[11px] font-mono uppercase tracking-widest text-gray-400">
                  <span>Altura da Linha</span>
                  <span className="text-[#B8A04A] font-bold">{prefs.lineHeight}</span>
                </div>
                <input 
                  type="range"
                  min="1.4"
                  max="2.2"
                  step="0.1"
                  value={prefs.lineHeight}
                  onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) })}
                  className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[#B8A04A]"
                />
              </div>

              {/* Font Family */}
              <div className="space-y-3">
                <label className="text-[11px] font-mono uppercase tracking-widest text-gray-400">Fonte (Tipografia)</label>
                <div className="grid grid-cols-1 gap-2">
                  {FONTS.map(font => (
                    <button
                      key={font.value}
                      onClick={() => onUpdate({ fontFamily: font.value })}
                      className={cn(
                        "w-full text-left px-4 py-2.5 rounded-xl text-xs transition-all",
                        prefs.fontFamily === font.value 
                          ? "bg-[#B8A04A] text-black font-bold" 
                          : "bg-white/5 text-gray-400 hover:bg-white/10"
                      )}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-8 text-[9px] uppercase tracking-widest text-center text-gray-700 font-bold border-t border-[#333] pt-4">
              Persistido localmente no seu dispositivo
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
