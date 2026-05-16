import React from 'react';
import { Doc } from '../types';
import { ICONS, FOLDER_COLORS } from '../constants';
import { sanitizeColor } from './sanitize';

export const getDocIcon = (doc: Doc) => {
  const role = doc.metadata.folder_role as keyof typeof FOLDER_COLORS;
  const defaultFolderColor = FOLDER_COLORS[role] || FOLDER_COLORS.manuscript;
  const color = sanitizeColor(doc.metadata?.folder_color, defaultFolderColor);
  
  if (role === 'trash') return <div className="w-4 h-4 flex items-center justify-center text-[#5A5A5A]" dangerouslySetInnerHTML={{ __html: ICONS.trash }} />;
  
  if (role === 'research') return <div className="w-4 h-4 flex items-center justify-center" style={{ color }} dangerouslySetInnerHTML={{ __html: ICONS.research }} />;
  if (role === 'characters') return <div className="w-4 h-4 flex items-center justify-center" style={{ color }} dangerouslySetInnerHTML={{ __html: ICONS.characters }} />;
  if (role === 'places') return <div className="w-4 h-4 flex items-center justify-center" style={{ color }} dangerouslySetInnerHTML={{ __html: ICONS.places }} />;
  
  if (doc.type === 'folder' || doc.type === 'front-matter') return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.folder(color) }} />;
  
  return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.textDoc(true) }} />;
};
