import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Folder, Trash2, Check, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Project } from '../types';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}

const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSelect,
  onCreate,
  onDelete
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onCreate(newProjectName.trim());
      setNewProjectName('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl z-[101] overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-[#333] bg-[#222]">
              <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                <Folder className="w-5 h-5 text-blue-400" />
                Meus Projetos
              </h2>
              <button onClick={onClose} className="p-1 hover:bg-[#333] rounded-md transition-colors text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => onSelect(proj.id)}
                    className={`group relative flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      activeProjectId === proj.id
                        ? 'bg-blue-500/10 border-blue-500/50'
                        : 'bg-[#252525] border-[#333] hover:border-[#444]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-100 truncate">{proj.name}</span>
                        {activeProjectId === proj.id && (
                          <Check className="w-4 h-4 text-blue-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {format(proj.updated_at || Date.now(), 'dd MMM yyyy')}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {deleteConfirmId === proj.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(proj.id);
                              setDeleteConfirmId(null);
                            }}
                            className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-md text-xs font-medium"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(null);
                            }}
                            className="p-1.5 bg-[#333] text-gray-400 hover:bg-[#444] rounded-md text-xs font-medium"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        projects.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(proj.id);
                            }}
                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreate} className="p-4 bg-[#222] border-t border-[#333]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Nome do novo projeto..."
                  className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-gray-600 text-white rounded-md transition-all flex items-center justify-center min-w-[40px]"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProjectsModal;
