import React, { useState } from 'react';
import { SignalCorrection } from '../types';
import { ChevronDown, ChevronUp, Clock, Eye, Crown, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { formatMultiplierBR } from '../utils/correctionEngine';

interface SignalInspectorProps {
  corrections: SignalCorrection[];
}

export const SignalInspector: React.FC<SignalInspectorProps> = ({ corrections }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const filteredCorrections = corrections.filter((c) => {
    if (filterCategory === 'all') return true;
    return c.category === filterCategory;
  });

  return (
    <div className="bg-[#120f1f] rounded-2xl border border-purple-900/40 p-5 shadow-xl shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-950/50 border border-amber-700/40 text-amber-300">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              Auditoria de Velas por Sinal
            </h3>
            <p className="text-xs text-slate-400">
              Inspecione as 6 velas analisadas em cada sinal e comprove o pico máximo atingido.
            </p>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 bg-[#0a0814] p-1 rounded-xl border border-purple-900/40 text-xs">
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              filterCategory === 'all'
                ? 'bg-purple-900/80 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({corrections.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('rose')}
            className={`px-2 py-1 rounded-lg font-medium transition-colors ${
              filterCategory === 'rose'
                ? 'bg-pink-900/80 text-pink-200'
                : 'text-slate-400 hover:text-pink-300'
            }`}
          >
            🌹 Rosas
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('fire')}
            className={`px-2 py-1 rounded-lg font-medium transition-colors ${
              filterCategory === 'fire'
                ? 'bg-amber-900/80 text-amber-200'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            🔥 Velas Altas
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('purple')}
            className={`px-2 py-1 rounded-lg font-medium transition-colors ${
              filterCategory === 'purple'
                ? 'bg-purple-900/80 text-purple-200'
                : 'text-slate-400 hover:text-purple-300'
            }`}
          >
            🟣 Roxas
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('red')}
            className={`px-2 py-1 rounded-lg font-medium transition-colors ${
              filterCategory === 'red'
                ? 'bg-rose-900/80 text-rose-200'
                : 'text-slate-400 hover:text-rose-300'
            }`}
          >
            ❌ Reds
          </button>
        </div>
      </div>

      {/* Accordion / Table list */}
      <div className="space-y-2">
        {filteredCorrections.map((item, idx) => {
          const isExpanded = expandedIndex === idx;
          const isNextMinute =
            item.winningCandle &&
            item.winningCandle.time.slice(0, 5) !== item.signalTime;

          return (
            <div
              key={idx}
              className={`rounded-xl border transition-all duration-150 overflow-hidden ${
                isExpanded
                  ? 'border-purple-600/80 bg-[#161226] shadow-md'
                  : 'border-purple-900/40 bg-[#0d0a17] hover:border-purple-700/60'
              }`}
            >
              {/* Row Header */}
              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                className="w-full px-4 py-3 flex items-center justify-between text-left gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-amber-300">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <span>{item.signalTime}</span>
                  </div>

                  <span className="text-sm font-bold font-mono text-slate-100 flex items-center gap-1">
                    • {item.found ? formatMultiplierBR(item.maxMultiplier) : 'Sem dados'} {item.emoji}
                  </span>

                  <span
                    className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.category === 'rose'
                        ? 'bg-pink-950/80 text-pink-300 border border-pink-700/60'
                        : item.category === 'fire'
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                        : item.category === 'purple'
                        ? 'bg-purple-950/80 text-purple-300 border border-purple-700/60'
                        : item.category === 'shield'
                        ? 'bg-blue-950/80 text-blue-300 border border-blue-700/60'
                        : 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
                    }`}
                  >
                    {item.categoryName}
                  </span>

                  {isNextMinute && (
                    <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800">
                      Pico no minuto seguinte ({item.winningCandle?.time.slice(0, 5)})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                    {item.matchingCandles.length} velas
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-purple-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </button>

              {/* Expanded details: 6 sequential candles cards */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-purple-900/40 bg-[#090714]">
                  {item.matchingCandles.length === 0 ? (
                    <p className="text-xs text-rose-400 py-2">
                      Nenhuma vela correspondente foi localizada para o horário {item.signalTime} no arquivo CSV carregado.
                    </p>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-slate-400">
                          Sequência das 6 velas a partir de {item.signalTime}:00
                        </span>
                        {item.winningCandle && (
                          <span className="text-[11px] text-amber-300 flex items-center gap-1 font-medium">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                            Maior vela encontrada na <strong>{item.winningIndex + 1}ª vela</strong> ({item.winningCandle.time})
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {item.matchingCandles.map((candle, cIdx) => {
                          const isWinner = cIdx === item.winningIndex;
                          const candleCategory =
                            candle.multiplier >= 10
                              ? 'rose'
                              : candle.multiplier >= 6
                              ? 'fire'
                              : candle.multiplier >= 3
                              ? 'purple'
                              : candle.multiplier >= 2.3
                              ? 'shield'
                              : 'red';

                          return (
                            <div
                              key={candle.id}
                              className={`p-2.5 rounded-xl border relative transition-all ${
                                isWinner
                                  ? 'bg-gradient-to-b from-purple-950 to-[#1e1335] border-amber-400 shadow-md ring-1 ring-amber-400/50'
                                  : 'bg-[#120f21] border-purple-900/40 opacity-85'
                              }`}
                            >
                              {isWinner && (
                                <div className="absolute -top-2 -right-1 bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase flex items-center gap-0.5 shadow-sm">
                                  <Crown className="w-2.5 h-2.5" /> Pico
                                </div>
                              )}

                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                                <span>{cIdx + 1}ª Vela</span>
                                <span>{candle.time}</span>
                              </div>

                              <div className="flex items-center justify-between mt-1">
                                <span
                                  className={`text-sm font-extrabold font-mono ${
                                    candleCategory === 'rose'
                                      ? 'text-pink-400'
                                      : candleCategory === 'fire'
                                      ? 'text-amber-400'
                                      : candleCategory === 'purple'
                                      ? 'text-purple-300'
                                      : candleCategory === 'shield'
                                      ? 'text-blue-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {formatMultiplierBR(candle.multiplier)}
                                </span>
                                <span className="text-xs">
                                  {candleCategory === 'rose'
                                    ? '🌹'
                                    : candleCategory === 'fire'
                                    ? '🔥'
                                    : candleCategory === 'purple'
                                    ? '🟣'
                                    : candleCategory === 'shield'
                                    ? '🛡'
                                    : '❌'}
                                </span>
                              </div>

                              <div className="text-[9px] text-slate-500 font-mono mt-1 truncate">
                                #{candle.roundId}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
