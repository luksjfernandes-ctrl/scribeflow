import React from 'react';
import { Doc } from '../types';
import { ICONS, FOLDER_COLORS } from '../constants';

export const getDocIcon = (doc: Doc) => {
  const role = doc.folder_role as keyof typeof FOLDER_COLORS;
  const color = FOLDER_COLORS[role] || FOLDER_COLORS.manuscript;
  
  if (role === 'trash') return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.trash }} />;
  if (role === 'research') return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.research }} />;
  if (role === 'characters') return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.characters }} />;
  if (role === 'places') return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.places }} />;
  
  if (doc.type === 'folder') return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.folder(role === 'manuscript' ? color : undefined) }} />;
  
  return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.textDoc(true) }} />;
};
