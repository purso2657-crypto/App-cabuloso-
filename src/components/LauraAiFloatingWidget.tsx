import React, { useState } from 'react';
import { Mic, MessageSquare, ChevronUp, ChevronDown, X, Sparkles, ExternalLink } from 'lucide-react';
import { SidebarTabId } from '../types';

interface LauraAiFloatingWidgetProps {
  onOpenFullLaura: () => void;
  activeTab: SidebarTabId;
}

export const LauraAiFloatingWidget: React.FC<LauraAiFloatingWidgetProps> = ({
  onOpenFullLaura,
  activeTab,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // If already on laura_ai tab, don't show the floating widget
  if (activeTab === 'laura_ai') {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end">
      {isOpen && (
        <div className="mb-3 w-80 sm:w-96 p-4 rounded-3xl bg-[#140e2b]/95 backdrop-blur-xl border border-pink-500/60 shadow-[0_0_30px_rgba(236,72,153,0.35)] text-slate-100 animate-slideUp">
          <div className="flex items-center justify-between pb-2.5 border-b border-purple-900/50">
            <div className="flex items-center gap-2">
              <span className="text-xl">👩‍💼</span>
              <div>
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  Laura AI
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-pink-950 text-pink-300 border border-pink-700/60 font-mono">
                    VOZ ATIVA
                  </span>
                </h4>
                <p className="text-[10px] text-purple-300/70">Assistente pessoal em tempo real</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-3 text-xs text-slate-300 space-y-2">
            <p>
              Quer conversar por voz com a <strong>Laura AI</strong> para saber a melhor sala do Aviator, momento de 5x+ ou próximos horários de ouro?
            </p>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenFullLaura();
              }}
              className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-pink-950/60 cursor-pointer transition-all hover:scale-[1.02]"
            >
              <Mic className="w-4 h-4 text-white animate-bounce" />
              <span>Abrir Conversa por Voz 🎙️</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating launcher button */}
      <button
        type="button"
        onClick={() => {
          if (!isOpen) {
            onOpenFullLaura();
          } else {
            setIsOpen(false);
          }
        }}
        className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-2xl shadow-pink-950/90 border border-pink-400/50 cursor-pointer transition-all hover:scale-105 active:scale-95"
        title="Falar com Laura AI por Voz"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-400 border border-black"></span>
        </span>
        <Mic className="w-4 h-4 text-white" />
        <span className="font-black tracking-wide">Falar com Laura AI 🎙️</span>
      </button>
    </div>
  );
};
