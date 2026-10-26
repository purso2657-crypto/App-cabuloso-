import React, { useState, useMemo } from 'react';
import { AviatorCandle, SidebarTabId } from '../types';
import {
  Flame,
  Copy,
  Check,
  Send,
  Sparkles,
  Zap,
  Target,
  ArrowRight,
  TrendingUp,
  Shield,
  Clock,
  Calendar,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatMultiplierBR } from '../utils/correctionEngine';

interface StrategyDetailViewProps {
  strategyId: SidebarTabId;
  candles: AviatorCandle[];
  onLoadSignalsToMain: (signalsText: string) => void;
}

interface StrategyConfig {
  title: string;
  emoji: string;
  badge: string;
  description: string;
  targetRule: string;
  headerTelegram: string;
  filterFn: (candles: AviatorCandle[]) => {
    signals: Array<{
      time: string;
      candle: AviatorCandle;
      detail: string;
      score: number;
    }>;
    insights: string[];
  };
}

export const StrategyDetailView: React.FC<StrategyDetailViewProps> = ({
  strategyId,
  candles,
  onLoadSignalsToMain,
}) => {
  const [copied, setCopied] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'afternoon' | 'night'>('all');

  const config: StrategyConfig = useMemo(() => {
    switch (strategyId) {
      case 'chuva_pirata':
        return {
          title: 'CHUVA DO PIRATA',
          emoji: '🏴‍☠️',
          badge: 'BURST DE PAGAMENTO',
          description: 'Identifica aglomerações e rajadas de velas pagadoras consecutivas (3+ velas >= 2.00x).',
          targetRule: 'Entrada após confirmação da 1ª vela pagadora na janela da rajada.',
          headerTelegram: '🏴‍☠️ LISTA CHUVA DO PIRATA - AVIATOR VIP 🏴‍☠️',
          filterFn: (list) => {
            const signals: any[] = [];
            for (let i = 0; i < list.length - 2; i++) {
              if (list[i].multiplier >= 2.0 && list[i + 1].multiplier >= 2.0 && list[i + 2].multiplier >= 2.0) {
                const maxInBurst = Math.max(list[i].multiplier, list[i + 1].multiplier, list[i + 2].multiplier);
                signals.push({
                  time: list[i].time.slice(0, 5),
                  candle: list[i],
                  detail: `Sequência de 3+ velas pagadoras (Pico: ${maxInBurst.toFixed(2)}x)`,
                  score: maxInBurst,
                });
                i += 2; // Jump sequence
              }
            }
            return {
              signals,
              insights: [
                `${signals.length} rajadas de pagamento detectadas`,
                'Gatilho ideal: Entrar na 2ª vela após confirmação roxa',
              ],
            };
          },
        };

      case 'surf_roxas':
        return {
          title: 'SURF DE ROXAS',
          emoji: '🏄',
          badge: 'TENDÊNCIA CONTÍNUA',
          description: 'Rastreia ondas prolongadas de velas roxas (2.00x a 9.99x) para saídas rápidas com altíssima taxa de acerto.',
          targetRule: 'Buscar saídas conservadoras de 2.00x a 3.00x durante o fluxo da onda.',
          headerTelegram: '🏄 SURF DE ROXAS OFICIAL - AVIATOR VIP 🏄',
          filterFn: (list) => {
            const signals: any[] = [];
            let streak = 0;
            list.forEach((c) => {
              if (c.multiplier >= 2.0 && c.multiplier < 10.0) {
                streak++;
                if (streak >= 3) {
                  signals.push({
                    time: c.time.slice(0, 5),
                    candle: c,
                    detail: `Onda de ${streak} velas roxas seguidas`,
                    score: streak,
                  });
                }
              } else {
                streak = 0;
              }
            });
            return {
              signals,
              insights: [
                `${signals.length} pontos de surf identificados`,
                'Recomendação: Meta de 2.00x no surf com proteção imediata',
              ],
            };
          },
        };

      case 'dez_x_bolso':
        return {
          title: '10X NO BOLSO',
          emoji: '💵',
          badge: 'ALTA ASSERTIVIDADE',
          description: 'Minutos chave com histórico de velas de 10x com gatilho de minutos pares/espelhos.',
          targetRule: 'Entrada no minuto exato com até 2 tentativas.',
          headerTelegram: '💵 10X NO BOLSO - SINAIS SELECIONADOS VIP 💵',
          filterFn: (list) => {
            const roses = list.filter((c) => c.multiplier >= 10.0);
            const signals = roses.map((c) => ({
              time: c.time.slice(0, 5),
              candle: c,
              detail: `Vela Rosa ${c.multiplier.toFixed(2)}x confirmada`,
              score: c.multiplier,
            }));
            return {
              signals,
              insights: [
                `${signals.length} velas rosa de 10x catalogadas`,
                'Gatilho: Entrada após vela roxa de confirmação',
              ],
            };
          },
        };

      case 'maxima_10_20':
        return {
          title: 'MÁXIMA 10x-20x',
          emoji: '🎯',
          badge: 'ROSA PADRÃO',
          description: 'Filtro exclusivo para velas na faixa clássica de 10.00x até 20.00x.',
          targetRule: 'Saída programada em 10.00x cravado.',
          headerTelegram: '🎯 LISTA MÁXIMA 10X A 20X - AVIATOR VIP 🎯',
          filterFn: (list) => {
            const matches = list.filter((c) => c.multiplier >= 10.0 && c.multiplier <= 20.0);
            const signals = matches.map((c) => ({
              time: c.time.slice(0, 5),
              candle: c,
              detail: `Vela ${c.multiplier.toFixed(2)}x`,
              score: c.multiplier,
            }));
            return {
              signals,
              insights: [`${matches.length} velas na faixa 10x-20x encontradas`],
            };
          },
        };

      case 'maxima_50':
        return {
          title: 'MÁXIMA 50X',
          emoji: '🔥',
          badge: 'SUPER VELAS',
          description: 'Filtragem das velas gigantes que ultrapassaram 50.00x.',
          targetRule: 'Buscar saídas escalonadas: 10x, 25x e topo em 50x.',
          headerTelegram: '🔥 SINAIS SUPER VELAS 50X+ - AVIATOR VIP 🔥',
          filterFn: (list) => {
            const matches = list.filter((c) => c.multiplier >= 50.0);
            const signals = matches.map((c) => ({
              time: c.time.slice(0, 5),
              candle: c,
              detail: `Super Vela ${c.multiplier.toFixed(2)}x`,
              score: c.multiplier,
            }));
            return {
              signals,
              insights: [`${matches.length} super velas >= 50x identificadas`],
            };
          },
        };

      case 'mil_x':
        return {
          title: '1000X LENDÁRIAS',
          emoji: '💯',
          badge: 'EXTREMO',
          description: 'Catalogação de multiplicadores extremos e raros acima de 100.00x e até 1000x.',
          targetRule: 'Entrada com mão leve buscando multiplicadores astronômicos.',
          headerTelegram: '💯 SINAIS VELA LENDÁRIA 100X A 1000X 💯',
          filterFn: (list) => {
            const matches = list.filter((c) => c.multiplier >= 100.0);
            const signals = matches.map((c) => ({
              time: c.time.slice(0, 5),
              candle: c,
              detail: `Vela Lendária ${c.multiplier.toFixed(2)}x`,
              score: c.multiplier,
            }));
            return {
              signals,
              insights: [`${matches.length} velas lendárias catalogadas`],
            };
          },
        };

      case 'duplas_x':
      default:
        return {
          title: 'DUPLAS X',
          emoji: '🔥',
          badge: 'ROSAS GEMINADAS',
          description: 'Identifica quando duas velas rosas ocorrem com intervalo curto (até 3 velas de distância).',
          targetRule: 'Após pagar uma rosa, manter a aposta na próxima rodada buscando a rosa dupla.',
          headerTelegram: '🔥 SINAIS ROSA DUPLA - AVIATOR VIP 🔥',
          filterFn: (list) => {
            const signals: any[] = [];
            for (let i = 0; i < list.length - 3; i++) {
              if (list[i].multiplier >= 10.0) {
                // Check if any of the next 3 candles is also >= 10x
                for (let j = 1; j <= 3 && i + j < list.length; j++) {
                  if (list[i + j].multiplier >= 10.0) {
                    signals.push({
                      time: list[i].time.slice(0, 5),
                      candle: list[i],
                      detail: `Rosa dupla: ${list[i].multiplier.toFixed(2)}x e ${list[i + j].multiplier.toFixed(2)}x (distância: ${j} velas)`,
                      score: list[i + j].multiplier,
                    });
                    break;
                  }
                }
              }
            }
            return {
              signals,
              insights: [`${signals.length} padrões de rosa dupla identificados`],
            };
          },
        };
    }
  }, [strategyId]);

  // Execute strategy filter
  const result = useMemo(() => {
    if (candles.length === 0) return { signals: [], insights: [] };
    return config.filterFn(candles);
  }, [candles, config]);

  // Unique extracted minutes
  const uniqueTimes = useMemo(() => {
    const times = Array.from(new Set(result.signals.map((s) => s.time)));
    return times.sort();
  }, [result.signals]);

  // Telegram generated text
  const telegramMessage = useMemo(() => {
    const lines = [
      config.headerTelegram,
      '',
      '🔗AVIATOR: betbrabo.com/casino/spribe/aviator-vip',
      '📌 Proteção: 2.30x',
      '🎯 Objetivo: 3x até 10X',
      '👉 Entrada: No minuto exato após uma ROXA🟣 APENAS 5 VEZES no máximo!',
      '',
      '⚠️SE CASO VIR UMA VELA ROSA NÃO ENTRAR ESPERAR A PRÓXIMA RODADA',
      '⚠️NÃO ENTRAR APÓS VELA ROSA',
      '⚠️NÃO ENTRAR EM VELAS ACIMA DE 10X',
      '',
      ...uniqueTimes.map((t) => `⏰ ${t} •`),
      '',
      '🚨 LEMBRANDO QUE SÃO APENAS 5 TENTATIVAS',
      '❌ CASO NÃO BATA NÃO ENTRAR MAIS',
      '',
      '🍀 BOA SORTE A TODOS 🍀',
    ];
    return lines.join('\n');
  }, [config, uniqueTimes]);

  const handleCopy = () => {
    navigator.clipboard.writeText(telegramMessage);
    setCopied(true);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendToMain = () => {
    onLoadSignalsToMain(uniqueTimes.join('\n'));
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.8 } });
  };

  if (candles.length === 0) {
    return (
      <div className="bg-[#0e0c1a] border border-purple-900/40 rounded-3xl p-8 text-center text-slate-400 space-y-3">
        <div className="text-4xl">{config.emoji}</div>
        <h3 className="text-lg font-bold text-slate-200">{config.title}</h3>
        <p className="text-xs text-purple-300/70 max-w-md mx-auto">
          Sincronizando rodadas da API Oficial em tempo real para calcular a estratégia {config.title}...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-[#120e24] border border-purple-800/50 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-950/80 border border-purple-700/50 flex items-center justify-center text-3xl shadow-lg shrink-0">
            {config.emoji}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-800">
                {config.badge}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {result.signals.length} ocorrências no histórico
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              {config.title}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              {config.description}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 border border-purple-400/40 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-950/60 cursor-pointer transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-300" />}
            <span>{copied ? 'Copiado para Telegram!' : 'Copiar Sinais'}</span>
          </button>

          <button
            onClick={handleSendToMain}
            className="px-4 py-2.5 rounded-xl bg-[#191432] hover:bg-[#251e4a] border border-purple-700/60 text-purple-200 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
            title="Enviar para a caixa de Sinais Bravo e auditar"
          >
            <Send className="w-4 h-4 text-pink-400" />
            <span>Auditar</span>
          </button>
        </div>
      </div>

      {/* Grid: Signal List (Left) + Telegram Output (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Signals List */}
        <div className="lg:col-span-6 bg-[#0f0b1f] border border-purple-900/40 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-purple-900/30">
            <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-pink-400" />
              Horários Catalogados ({uniqueTimes.length} minutos únicos)
            </h3>
            <span className="text-[11px] font-mono text-purple-300">
              Regra: {config.targetRule}
            </span>
          </div>

          <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
            {result.signals.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Aguardando padrões desta estratégia no histórico ao vivo da API oficial...
              </p>
            ) : (
              result.signals.map((sig, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#151028] border border-purple-900/30 hover:border-purple-600/50 transition-all text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-amber-300 text-sm">
                      ⏰ {sig.time}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {sig.detail}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-pink-400 bg-pink-950/60 px-2 py-0.5 rounded-lg border border-pink-800/40 text-[11px]">
                    {formatMultiplierBR(sig.candle.multiplier)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Telegram Preview */}
        <div className="lg:col-span-6 bg-[#0f0b1f] border border-purple-900/40 rounded-3xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-purple-900/30 mb-3">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-4 h-4 text-cyan-400" />
                Mensagem Formatada Telegram
              </h3>
              <span className="text-[11px] text-emerald-400 font-mono">
                Pronta para envio
              </span>
            </div>

            <textarea
              readOnly
              value={telegramMessage}
              rows={14}
              className="w-full bg-[#080512] border border-purple-950 rounded-2xl p-4 font-mono text-xs text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-inner"
            />
          </div>

          <button
            onClick={handleCopy}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-950/80 cursor-pointer transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-amber-300" />}
            <span>{copied ? 'Copiado!' : 'Copiar Lista para Telegram'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
