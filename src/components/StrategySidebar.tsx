import React from 'react';
import { SidebarTabId } from '../types';
import { Plane, Zap } from 'lucide-react';

interface StrategySidebarProps {
  activeTab: SidebarTabId;
  onSelectTab: (tab: SidebarTabId) => void;
  candlesCount: number;
}

interface MenuItem {
  id: SidebarTabId;
  label: string;
  emoji: string;
  dotColor: string; // Tailwind color class for the right-side dot
  badge?: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'laura_ai',
    label: 'LAURA AI (VOZ)',
    emoji: '🎙️',
    dotColor: 'bg-pink-500 shadow-[0_0_10px_#ec4899]',
    badge: 'VOZ',
  },
  {
    id: 'whatsapp',
    label: 'CENTRAL WHATSAPP',
    emoji: '💬',
    dotColor: 'bg-emerald-400 shadow-[0_0_10px_#34d399]',
    badge: 'AUTO',
  },
  {
    id: 'temperatura',
    label: 'DASHBOARD LAURA AI',
    emoji: '🤖',
    dotColor: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
    badge: '24H',
  },
  {
    id: 'correcao',
    label: 'CORREÇÃO BRAVA',
    emoji: '🎯',
    dotColor: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
    badge: 'VIP',
  },
  {
    id: 'aviator_1',
    label: 'AVIATOR 1',
    emoji: '✈️',
    dotColor: 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]',
    badge: 'SALA 1',
  },
  {
    id: 'radar_ao_vivo',
    label: 'AVIATOR 2 (RADAR)',
    emoji: '📡',
    dotColor: 'bg-purple-400 shadow-[0_0_8px_#c084fc]',
    badge: 'LIVE',
  },
  {
    id: 'aviator_premium',
    label: 'AVIATOR PREMIUM',
    emoji: '👑',
    dotColor: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
    badge: 'VIP',
  },
  {
    id: 'listinha_10x',
    label: 'LISTINHA 10X',
    emoji: '🚨',
    dotColor: 'bg-rose-500 shadow-[0_0_8px_#f43f5e]',
  },
  {
    id: 'maxima_10_20',
    label: 'MÁXIMA 10x-20x',
    emoji: '🎯',
    dotColor: 'bg-purple-400 shadow-[0_0_8px_#c084fc]',
  },
  {
    id: 'maxima_50',
    label: 'MÁXIMA 50X',
    emoji: '🔥',
    dotColor: 'bg-pink-500 shadow-[0_0_8px_#ec4899]',
  },
  {
    id: 'mil_x',
    label: '1000X',
    emoji: '💯',
    dotColor: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
  },
  {
    id: 'duplas_x',
    label: 'DUPLAS X',
    emoji: '🔥',
    dotColor: 'bg-orange-400 shadow-[0_0_8px_#fb923c]',
  },
];

export const StrategySidebar: React.FC<StrategySidebarProps> = ({
  activeTab,
  onSelectTab,
  candlesCount,
}) => {
  return (
    <aside
      id="strategy-sidebar"
      className="w-full lg:w-72 shrink-0 bg-[#090714] border-r border-purple-950/60 p-3 sm:p-4 flex flex-col justify-between"
    >
      <div className="space-y-2">
        {/* Sidebar Mini Header */}
        <div className="px-2 py-2 mb-2 flex items-center justify-between border-b border-purple-900/30">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-950 flex items-center justify-center border border-purple-800/60">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider text-purple-300">
              Estratégias Bravo
            </span>
          </div>
          {candlesCount > 0 && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/50">
              {candlesCount.toLocaleString()} velas
            </span>
          )}
        </div>

        {/* Menu Items */}
        <nav className="space-y-1.5" aria-label="Estratégias">
          {MENU_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`tab-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                type="button"
                className={`w-full group relative flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-200 cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#140f29] border-2 border-purple-500 shadow-[0_0_18px_rgba(168,85,247,0.45)] text-white'
                    : 'bg-transparent hover:bg-purple-950/30 border border-transparent hover:border-purple-900/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                {/* Left: Emoji + Label */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg shrink-0 select-none">
                    {item.emoji}
                  </span>
                  <span
                    className={`text-[12px] sm:text-[13px] font-extrabold tracking-wide truncate ${
                      isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>

                {/* Right: Badge / Dot Indicator */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {item.badge && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500 text-black">
                      {item.badge}
                    </span>
                  )}
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${item.dotColor} ${
                      isActive ? 'scale-125' : 'opacity-70 group-hover:opacity-100'
                    } transition-all`}
                  />
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="pt-4 mt-4 border-t border-purple-900/30 px-2 text-[11px] text-purple-300/50 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Plane className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-slate-400">Analista Bravo</span>
        </div>
        <span className="font-mono text-[10px] text-purple-400">v2.4 VIP</span>
      </div>
    </aside>
  );
};
