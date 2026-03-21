import { useMemo } from 'react';
import { Doc, FolderRole } from '../types';

export function useStructuralFolders(docs: Doc[]) {
  return useMemo(() => {
    return {
      manuscript: docs.find(d => d.folder_role === 'manuscript'),
      characters: docs.find(d => d.folder_role === 'characters'),
      places: docs.find(d => d.folder_role === 'places'),
      research: docs.find(d => d.folder_role === 'research'),
      trash: docs.find(d => d.folder_role === 'trash'),
    };
  }, [docs]);
}

export function getStructuralFolder(docs: Doc[], role: FolderRole): Doc | undefined {
  return docs.find(d => d.folder_role === role);
}
