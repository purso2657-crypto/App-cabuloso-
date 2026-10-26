import React, { useState } from 'react';
import { Copy, Check, Download, Send, Sparkles, MessageSquare, Share2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface TelegramOutputProps {
  messageText: string;
  totalSignals: number;
}

export const TelegramOutput: React.FC<TelegramOutputProps> = ({
  messageText,
  totalSignals,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentText, setCurrentText] = useState(messageText);

  // Sync if prop changes and not editing
  React.useEffect(() => {
    setCurrentText(messageText);
  }, [messageText]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentText);
      setCopied(true);

      // Trigger celebratory confetti
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#a855f7', '#fbbf24', '#ec4899', '#3b82f6'],
      });

      setTimeout(() => {
        setCopied(false);
      }, 3000);
    } catch {
      // Fallback copy using textarea
      const el = document.createElement('textarea');
      el.value = currentText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleDownloadTxt = () => {
    const element = document.createElement('a');
    const file = new Blob([currentText], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `correcao_aviator_vip_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="bg-[#120f1f] rounded-2xl border border-purple-900/40 p-5 shadow-xl shadow-black/30 flex flex-col justify-between">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-950/60 border border-sky-600/40 text-sky-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Radar Aviator VIP — Correção
                <span className="text-xs px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-800/40 font-mono">
                  Formato Oficial
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Padrão por blocos de horário com destaques e emojis oficiais do Radar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-200 bg-purple-950/80 hover:bg-purple-900/80 border border-purple-800/60 rounded-lg transition-colors"
              title="Baixar lista em arquivo .txt"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar .TXT</span>
            </button>
          </div>
        </div>

        {/* Telegram Chat Mock Container */}
        <div className="relative rounded-xl bg-gradient-to-b from-[#0e1621] to-[#17212b] border border-sky-900/40 p-4 sm:p-5 shadow-inner mt-2">
          {/* Header of Telegram message */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-sky-900/40">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-600 to-amber-400 flex items-center justify-center text-[10px] font-black text-black">
                AB
              </div>
              <div>
                <span className="text-xs font-bold text-sky-300 block leading-tight">
                  Analista Bravo • VIP Oficial
                </span>
                <span className="text-[10px] text-slate-400">Canal de Sinais Aviator</span>
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Formatted message content preview */}
          <textarea
            id="telegram-output-textarea"
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            rows={14}
            className="w-full bg-transparent border-0 text-slate-100 text-xs sm:text-sm font-sans leading-relaxed resize-y focus:outline-none selection:bg-sky-500/40 selection:text-white"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          />
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="mt-4 pt-3 border-t border-purple-900/40 flex flex-col sm:flex-row items-center gap-3">
        <button
          id="btn-copy-telegram"
          type="button"
          onClick={handleCopy}
          className={`w-full py-3.5 px-6 rounded-xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all duration-200 shadow-xl ${
            copied
              ? 'bg-emerald-500 text-black shadow-emerald-950/60 scale-[1.02]'
              : 'bg-gradient-to-r from-sky-500 via-sky-400 to-blue-500 hover:from-sky-400 hover:to-blue-400 text-slate-950 shadow-sky-950/60 hover:scale-[1.01] cursor-pointer'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 text-black font-black" />
              <span>COPIADO PARA O TELEGRAM COM SUCESSO! 🚀</span>
            </>
          ) : (
            <>
              <Copy className="w-5 h-5 text-black" />
              <span>COPIAR PARA TELEGRAM (1-CLIQUE)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
