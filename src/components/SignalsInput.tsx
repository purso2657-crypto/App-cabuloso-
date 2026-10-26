import React from 'react';
import { Clock, Sparkles, Trash2, ArrowRight, Wand2 } from 'lucide-react';
import { extractSignalTimes } from '../utils/correctionEngine';

interface SignalsInputProps {
  signalsText: string;
  onChangeText: (text: string) => void;
  onGenerate: () => void;
  canGenerate: boolean;
  hasCandles: boolean;
}

export const SignalsInput: React.FC<SignalsInputProps> = ({
  signalsText,
  onChangeText,
  onGenerate,
  canGenerate,
  hasCandles,
}) => {
  const extractedTimes = extractSignalTimes(signalsText);

  const handleCleanAndFilter = () => {
    if (extractedTimes.length > 0) {
      onChangeText(extractedTimes.join('\n'));
    }
  };

  const handleClear = () => {
    onChangeText('');
  };

  return (
    <div className="bg-[#120f1f] rounded-2xl border border-purple-900/40 p-5 shadow-xl shadow-black/30 flex flex-col justify-between">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-900/50 border border-purple-700/40 text-purple-300">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Sinais Bravo
                <span className="text-xs px-2 py-0.5 rounded bg-purple-950/80 text-amber-300 border border-purple-800/40 font-mono">
                  {extractedTimes.length} {extractedTimes.length === 1 ? 'sinal' : 'sinais'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Cole a lista de horários enviados para o grupo (um por linha no formato HH:MM).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {signalsText && (
              <>
                <button
                  type="button"
                  onClick={handleCleanAndFilter}
                  title="Limpar textos extras e deixar apenas os horários HH:MM"
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-purple-200 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/50 rounded-lg cursor-pointer"
                >
                  <Wand2 className="w-3 h-3 text-purple-300" />
                  Filtrar
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                  title="Limpar caixa de texto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="relative mt-2">
          <textarea
            id="signals-textarea"
            value={signalsText}
            onChange={(e) => onChangeText(e.target.value)}
            rows={8}
            placeholder={`Exemplo de lista:\n14:05\n14:12\n14:26\n14:33\n14:41\n...\n(Aceita qualquer texto com horários HH:MM)`}
            className="w-full bg-[#0a0814] border border-purple-900/50 focus:border-amber-400 rounded-xl p-3.5 text-sm font-mono text-amber-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/50 transition-all resize-y leading-relaxed shadow-inner"
          />

          {extractedTimes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 max-h-16 overflow-y-auto p-1.5 bg-[#090712] rounded-lg border border-purple-950 text-[11px] font-mono">
              <span className="text-slate-400 mr-1 text-[10px] uppercase font-bold tracking-wider self-center">
                Detectados:
              </span>
              {extractedTimes.slice(0, 10).map((t, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-800/40 text-purple-200"
                >
                  {t}
                </span>
              ))}
              {extractedTimes.length > 10 && (
                <span className="px-1.5 py-0.5 rounded bg-purple-900/40 text-amber-300">
                  +{extractedTimes.length - 10} mais...
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Big Action CTA */}
      <div className="mt-4 pt-3 border-t border-purple-900/40">
        <button
          id="btn-generate-correction"
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className={`w-full py-3.5 px-6 rounded-xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all duration-200 shadow-lg ${
            canGenerate
              ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black shadow-amber-950/60 hover:scale-[1.01] cursor-pointer'
              : 'bg-purple-950/40 text-purple-400/40 border border-purple-900/30 cursor-not-allowed'
          }`}
        >
          <Sparkles className="w-5 h-5 text-black animate-pulse" />
          <span>GERAR CORREÇÃO BRAVA</span>
          <ArrowRight className="w-5 h-5 text-black" />
        </button>

        {!hasCandles && (
          <p className="text-[11px] text-center text-amber-400/80 mt-2">
            ⚡ Sincronizando com a API oficial do Aviator ao lado para auditar as rodadas ao vivo.
          </p>
        )}
        {hasCandles && extractedTimes.length === 0 && (
          <p className="text-[11px] text-center text-slate-400 mt-2">
            ℹ️ Digite ou cole ao menos um horário de sinal no campo acima.
          </p>
        )}
      </div>
    </div>
  );
};
