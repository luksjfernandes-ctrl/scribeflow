import React from 'react';
import { cn } from '../lib/utils';

interface MenuItem {
  label?: string;
  shortcut?: string;
  onClick?: () => void;
  divider?: boolean;
}

interface Menu {
  label: string;
  items: MenuItem[];
}

interface MenuBarProps {
  menus: Menu[];
}

export function MenuBar({ menus }: MenuBarProps) {
  return (
    <div className="menu-bar">
      {/* Window Controls (Traffic Lights) */}
      <div className="flex gap-2 px-2 mr-4 -webkit-app-region: no-drag;">
        <div className="w-3 h-3 rounded-full bg-[#FF5F57] border border-[#E0443E] hover:after:content-['×'] after:flex after:items-center after:justify-center after:text-[8px] after:text-black/40" />
        <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] hover:after:content-['−'] after:flex after:items-center after:justify-center after:text-[8px] after:text-black/40" />
        <div className="w-3 h-3 rounded-full bg-[#28C840] border border-[#1AAB29] hover:after:content-['+'] after:flex after:items-center after:justify-center after:text-[8px] after:text-black/40" />
      </div>

      <div className="flex items-center gap-1 -webkit-app-region: no-drag;">
        <div className="px-2 py-0.5 hover:bg-[#5B7A3D] hover:text-white rounded-md cursor-default font-bold">ScribeFlow</div>
        {menus.map((menu, idx) => (
          <div key={idx} className="menu-item">
            {menu.label}
            <div className="menu-dropdown">
              {menu.items.map((item, itemIdx) => (
                <React.Fragment key={itemIdx}>
                  {item.divider ? (
                    <div className="dropdown-divider" />
                  ) : (
                    <div 
                      className="dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        item.onClick?.();
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className="dropdown-shortcut">{item.shortcut}</span>}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
