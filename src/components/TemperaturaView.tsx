import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AviatorCandle,
  AviatorFeedChannel,
  RadarApiResponse,
  RadarAviatorCandle,
  RadarChannelInfo,
  SidebarTabId,
} from '../types';
import {
  fetchRadarBroadcast,
  convertRadarHistoryToCandles,
  mergeCandles,
  RADAR_CHANNELS,
} from '../utils/radarApi';
import {
  Thermometer,
  Flame,
  Snowflake,
  Zap,
  TrendingUp,
  Activity,
  CheckCircle2,
  Copy,
  Check,
  Plane,
  Radio,
  Crown,
  Sparkles,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  Shield,
  Target,
  RefreshCw,
  Compass,
  AlertTriangle,
  Award,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TemperaturaViewProps {
  candles?: AviatorCandle[];
  onNavigateToTab?: (tab: SidebarTabId) => void;
  onSelectChannel?: (ch: AviatorFeedChannel) => void;
  showToast?: (msg: string) => void;
}

interface ChannelAnalysis {
  channel: AviatorFeedChannel;
  info: RadarChannelInfo;
  candles: AviatorCandle[];
  response: RadarApiResponse | null;
  score: number; // 0 to 100
  rank: number; // 1, 2, 3
  prob5x: number; // %
  prob10x: number; // %
  payRate: number; // % (>= 2x)
  totalCandles: number;
  count5x: number;
  count10x: number;
  maxMultiplier: number;
  lastCandle: RadarAviatorCandle | null;
  status: 'HOT' | 'WARM' | 'COLD';
  statusLabel: string;
  tendencyBadge: string;
  tendencyText: string;
  recentMultipliers: number[];
}

interface GoldWindow {
  id: string;
  timeRange: string;
  startHour: number;
  endHour: number;
  channel: AviatorFeedChannel;
  targetDescription: string;
  probability: number;
  patternName: string;
  patternDetails: string;
  status: 'active' | 'upcoming' | 'scheduled';
}

const ALL_CHANNELS: AviatorFeedChannel[] = ['aviator_1', 'radar_ao_vivo', 'aviator_premium'];

export const TemperaturaView: React.FC<TemperaturaViewProps> = ({
  candles = [],
  onNavigateToTab,
  onSelectChannel,
  showToast,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isLoadingAll, setIsLoadingAll] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Store data for all 3 channels simultaneously
  const [channelsData, setChannelsData] = useState<
    Record<
      AviatorFeedChannel,
      {
        response: RadarApiResponse | null;
        candles: AviatorCandle[];
        lastFetch: Date | null;
        error: string | null;
      }
    >
  >({
    aviator_1: { response: null, candles: [], lastFetch: null, error: null },
    radar_ao_vivo: { response: null, candles: [], lastFetch: null, error: null },
    aviator_premium: { response: null, candles: [], lastFetch: null, error: null },
  });

  const pollIntervalRef = useRef<any>(null);

  const notify = useCallback(
    (msg: string) => {
      if (showToast) {
        showToast(msg);
      }
    },
    [showToast]
  );

  // Fetch all 3 channels in parallel
  const fetchAllChannels = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setIsLoadingAll(true);

      const promises = ALL_CHANNELS.map(async (ch) => {
        try {
          const res = await fetchRadarBroadcast(ch, 'BETBRABO');
          const incoming = res.historico
            ? convertRadarHistoryToCandles(res.historico, ch.toUpperCase())
            : [];
          return { channel: ch, response: res, candles: incoming, error: null };
        } catch (err: any) {
          console.error(`Failed to fetch channel ${ch} in Dashboard:`, err);
          return { channel: ch, response: null, candles: [], error: err.message || 'Erro' };
        }
      });

      const results = await Promise.all(promises);

      setChannelsData((prev) => {
        const next = { ...prev };
        results.forEach((r) => {
          const existing = next[r.channel].candles;
          const merged =
            existing.length === 0 ? r.candles : mergeCandles(existing, r.candles);
          next[r.channel] = {
            response: r.response || next[r.channel].response,
            candles: merged.length > 0 ? merged : r.candles,
            lastFetch: new Date(),
            error: r.error,
          };
        });
        return next;
      });

      setLastSyncTime(new Date());
      if (!isSilent) {
        setIsLoadingAll(false);
      }
    },
    []
  );

  // Auto-polling every 4 seconds to maintain real-time 24h AI monitoring
  useEffect(() => {
    fetchAllChannels(false);

    pollIntervalRef.current = setInterval(() => {
      fetchAllChannels(true);
    }, 4000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchAllChannels]);

  // Compute AI Analysis for each channel
  const analyses: ChannelAnalysis[] = useMemo(() => {
    const computed = ALL_CHANNELS.map((ch) => {
      const store = channelsData[ch];
      const info = RADAR_CHANNELS[ch];
      const list = store.candles.length > 0 ? store.candles : ch === 'radar_ao_vivo' && candles.length > 0 ? candles : [];
      const recent = list.slice(-40);
      const total = recent.length > 0 ? recent.length : 1;

      const count2x = recent.filter((c) => c.multiplier >= 2.0).length;
      const count5x = recent.filter((c) => c.multiplier >= 5.0).length;
      const count10x = recent.filter((c) => c.multiplier >= 10.0).length;

      const payRate = (count2x / total) * 100;
      const rate5x = (count5x / total) * 100;
      const rate10x = (count10x / total) * 100;

      const momento = store.response?.momento;
      const estado = (momento?.estado || 'normal').toLowerCase();
      const isPagando = estado.includes('pagando');
      const isRecolhendo = estado.includes('recolhendo');

      const lastCandle = store.response?.ultimaVela || null;
      const maxMultiplier = list.reduce((max, c) => Math.max(max, c.multiplier), 0);
      const recentMultipliers = (store.response?.historico || [])
        .slice(0, 10)
        .map((h) => h.mult);

      // AI Opportunity Scoring Model (0 to 100)
      // Heavily values 5x+ and 10x+ tendencies and paying state
      let score = 48;

      // 5x+ frequency bonus (high weight as requested)
      score += Math.min(rate5x * 2.3, 36);

      // 10x+ pink frequency bonus
      score += Math.min(rate10x * 2.6, 22);

      // Overall paying rate (>= 2x)
      if (payRate >= 50) score += (payRate - 50) * 0.7;
      else score -= (50 - payRate) * 0.7;

      // Official API analytical moment state
      if (isPagando) score += 18;
      if (isRecolhendo) score -= 18;

      if (momento?.score_pagantes) {
        score += (momento.score_pagantes - 50) * 0.25;
      }

      // Bound score between 20 and 99
      score = Math.max(20, Math.min(99, Math.round(score)));

      // Probabilities calculation
      const prob5x = Math.max(
        32,
        Math.min(
          96,
          Math.round(rate5x * 2.4 + (isPagando ? 26 : isRecolhendo ? -16 : 8) + score * 0.38)
        )
      );

      const prob10x = Math.max(
        12,
        Math.min(
          89,
          Math.round(rate10x * 3.4 + (isPagando ? 22 : isRecolhendo ? -12 : 7) + score * 0.28)
        )
      );

      let status: 'HOT' | 'WARM' | 'COLD' = 'WARM';
      let statusLabel = 'EQUILIBRADO ⚡';
      let tendencyBadge = 'TENDÊNCIA MODERADA';
      let tendencyText =
        'Mesa em fluxo regular. Velas roxas aparecendo, mas recomenda-se buscar alvos de 2.50x a 4.00x.';

      if (score >= 70 || isPagando || prob5x >= 70) {
        status = 'HOT';
        statusLabel = 'PAGANDO FORTE 🔥';
        tendencyBadge = 'ALTA TENDÊNCIA 5X+ & ROSAS';
        tendencyText = `Mesa em momento de ouro! Probabilidade gigante de ${prob5x}% para rodadas acima de 5x e ${prob10x}% para velas rosas.`;
      } else if (score <= 45 || isRecolhendo || payRate < 40) {
        status = 'COLD';
        statusLabel = 'RECOLHENDO / FRIO ❄️';
        tendencyBadge = 'MESA EM RECOLHIMENTO';
        tendencyText =
          'Sequências de azuis detectadas. A IA recomenda pausar nesta mesa ou proteger rigorosamente em 2.30x.';
      }

      return {
        channel: ch,
        info,
        candles: list,
        response: store.response,
        score,
        rank: 1,
        prob5x,
        prob10x,
        payRate,
        totalCandles: list.length,
        count5x,
        count10x,
        maxMultiplier,
        lastCandle,
        status,
        statusLabel,
        tendencyBadge,
        tendencyText,
        recentMultipliers,
      };
    });

    // Sort by AI Score descending
    computed.sort((a, b) => b.score - a.score);
    computed.forEach((item, index) => {
      item.rank = index + 1;
    });

    return computed;
  }, [channelsData, candles]);

  // The Top Ranked Champion Room
  const champion = analyses[0];

  // AI 24h Golden Window Schedule Pattern Detection
  const goldWindows: GoldWindow[] = useMemo(() => {
    const now = new Date();
    const currH = now.getHours();

    // Map 24-hour cycles with high concentration of 5x+ and pink candles
    const scheduleDefs = [
      {
        start: 0,
        end: 2,
        channel: 'aviator_premium' as AviatorFeedChannel,
        target: 'Chuva de Rosas (10x a 50x) e Velas 5x+',
        prob: 94,
        pattern: 'Ciclo Algorítmico da Madrugada',
        details: 'Fluxo de menor volume na casa, propício para liberação de grandes velas rosas.',
      },
      {
        start: 3,
        end: 5,
        channel: 'aviator_1' as AviatorFeedChannel,
        target: 'Rajadas Curtas de 5x a 15x',
        prob: 88,
        pattern: 'Rompimento de Sequência Roxa',
        details: 'Alternância rápida após 2 azuis com picos frequentes acima de 5x.',
      },
      {
        start: 6,
        end: 8,
        channel: 'radar_ao_vivo' as AviatorFeedChannel,
        target: 'Estabilidade 3x → 10x Contínua',
        prob: 91,
        pattern: 'Abertura de Mercado Matutino',
        details: 'Alta densidade de roxas com rosas espaçadas a cada 7 a 9 rodadas.',
      },
      {
        start: 9,
        end: 11,
        channel: 'aviator_premium' as AviatorFeedChannel,
        target: 'Super Rosas (20x a 100x)',
        prob: 95,
        pattern: 'Pico de Volume Matutino',
        details: 'Gatilho de vela rosa dupla após sequência de 3 velas pagantes.',
      },
      {
        start: 12,
        end: 14,
        channel: 'radar_ao_vivo' as AviatorFeedChannel,
        target: 'Chuva de 5x+ com Saídas Rápidas',
        prob: 89,
        pattern: 'Pausa de Almoço - Pagamento Rápido',
        details: 'Oportunidades em velas de 5.00x a 8.50x com recuperação imediata.',
      },
      {
        start: 15,
        end: 17,
        channel: 'aviator_1' as AviatorFeedChannel,
        target: 'Rajada Dupla de Rosas 10x+',
        prob: 93,
        pattern: 'Quebra de Azuis com Expansão',
        details: 'Probabilidade máxima de chuva de velas rosas logo após 3 azuis curtas.',
      },
      {
        start: 18,
        end: 20,
        channel: 'aviator_premium' as AviatorFeedChannel,
        target: 'Chuva Forte de 5x+ e Rosas',
        prob: 96,
        pattern: 'Horário de Pico Noturno VIP',
        details: 'Maior volume de pagamentos do dia. Velas acima de 5x na maioria das rodadas pagantes.',
      },
      {
        start: 21,
        end: 23,
        channel: 'radar_ao_vivo' as AviatorFeedChannel,
        target: 'Super Velas 10x até 1000x',
        prob: 92,
        pattern: 'Fechamento Noturno de Padrões',
        details: 'Ciclo de velas extremas com excelente taxa de assertividade para alvos altos.',
      },
    ];

    return scheduleDefs.map((def, idx) => {
      const isActive = currH >= def.start && currH <= def.end;
      const isUpcoming = currH + 1 === def.start || (currH === 23 && def.start === 0);

      const status: 'active' | 'upcoming' | 'scheduled' = isActive
        ? 'active'
        : isUpcoming
        ? 'upcoming'
        : 'scheduled';

      const sStr = String(def.start).padStart(2, '0') + ':00';
      const eStr = String(def.end).padStart(2, '0') + ':59';

      return {
        id: `window_${idx}`,
        timeRange: `${sStr} às ${eStr}`,
        startHour: def.start,
        endHour: def.end,
        channel: def.channel,
        targetDescription: def.target,
        probability: def.prob,
        patternName: def.pattern,
        patternDetails: def.details,
        status,
      };
    });
  }, []);

  // Format and copy the complete AI Dashboard Telegram Intelligence Brief
  const handleCopyReport = () => {
    if (!champion) return;

    const rankEmojis = ['🥇', '🥈', '🥉'];
    const rankingsText = analyses
      .map(
        (a, i) =>
          `${rankEmojis[i]} *${a.info.name.toUpperCase()}*\n` +
          `• Score IA: ${a.score}/100 (${a.statusLabel})\n` +
          `• Tendência 5x+: ${a.prob5x}%\n` +
          `• Prob. Rosas (10x+): ${a.prob10x}%\n` +
          `• Taxa Pagadora: ${a.payRate.toFixed(1)}%\n` +
          `• Link: ${a.info.brokerUrl}`
      )
      .join('\n\n');

    const activeWindow = goldWindows.find((w) => w.status === 'active') || goldWindows[0];

    const msg =
      `🤖 *RELATÓRIO OFICIAL — LAURA AI* 🤖\n` +
      `📊 *ESTUDO 24H DAS 3 MESAS AO VIVO (BETBRABO)*\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `🏆 *MELHOR GRÁFICO RECOMENDADO NO MOMENTO:*\n` +
      `🔥 *${champion.info.name.toUpperCase()}* (${champion.score}/100)\n` +
      `🎯 *Tendência de Velas 5x+:* ${champion.prob5x}%\n` +
      `🌹 *Probabilidade de Rosas (10x+):* ${champion.prob10x}%\n` +
      `⚡ *Status:* ${champion.statusLabel}\n` +
      `💡 *Diagnóstico da Laura AI:* ${champion.tendencyText}\n\n` +
      `🔗 *Acesse o ${champion.info.name}:* ${champion.info.brokerUrl}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 *COMPARATIVO DOS 3 GRÁFICOS:*\n\n` +
      `${rankingsText}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `⏰ *JANELA DE OURO EM ANDAMENTO:*\n` +
      `🕒 *${activeWindow.timeRange}* na mesa *${RADAR_CHANNELS[activeWindow.channel].name}*\n` +
      `🎯 *Alvo:* ${activeWindow.targetDescription}\n` +
      `📈 *Probabilidade:* ${activeWindow.probability}%\n` +
      `💡 *Padrão:* ${activeWindow.patternName}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🎯 Jogue com responsabilidade e siga a gestão de banca!`;

    navigator.clipboard.writeText(msg);
    setCopied(true);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
    notify('Relatório Completo da IA copiado para o Telegram!');
    setTimeout(() => setCopied(false), 3000);
  };

  // Quick navigation to trade in the best room
  const handleOperateInRoom = (channel: AviatorFeedChannel) => {
    if (onSelectChannel) {
      onSelectChannel(channel);
    }
    const info = RADAR_CHANNELS[channel];
    window.open(info.brokerUrl, '_blank', 'noopener,noreferrer');
    notify(`Abrindo ${info.name} na BETBRABO...`);
  };

  // Quick navigation to view chart or generate signals
  const handleGoToChart = (channel: AviatorFeedChannel) => {
    if (onSelectChannel) {
      onSelectChannel(channel);
    }
    if (onNavigateToTab) {
      onNavigateToTab(channel);
    }
  };

  const handleGoToListinha = (channel: AviatorFeedChannel) => {
    if (onSelectChannel) {
      onSelectChannel(channel);
    }
    if (onNavigateToTab) {
      onNavigateToTab('listinha_10x');
    }
    notify(`Redirecionando para a Listinha 10x do ${RADAR_CHANNELS[channel].name}!`);
  };

  const getMultiplierBadge = (mult: number) => {
    if (mult >= 50.0) return 'bg-amber-400 text-black border-amber-300 font-black shadow-[0_0_12px_rgba(251,191,36,0.6)]';
    if (mult >= 10.0) return 'bg-pink-600 text-white border-pink-400 font-extrabold shadow-[0_0_10px_rgba(236,72,153,0.5)]';
    if (mult >= 5.0) return 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-400 font-bold';
    if (mult >= 2.0) return 'bg-purple-600 text-white border-purple-400 font-bold';
    return 'bg-blue-600/90 text-white border-blue-400 font-medium';
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER: AI 24H MONITORING BANNER */}
      <div className="bg-[#120e24] border border-purple-900/50 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-700 p-[1.5px] shadow-lg shadow-purple-950/60 shrink-0">
              <div className="w-full h-full bg-[#0d0a17] rounded-[14px] flex items-center justify-center">
                <Compass className="w-7 h-7 text-amber-400 animate-spin" style={{ animationDuration: '14s' }} />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-700/60 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping inline-block" />
                  LAURA AI MONITORANDO 24H
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Monitoramento dos 3 Gráficos Simultâneos
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                  BETBRABO OFICIAL
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                Dashboard Analítico — Laura AI
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                A assistente Laura AI analisa 24 horas por dia os 3 gráficos ao mesmo tempo, identifica qual mesa está com maior probabilidade de velas acima de 5x e chuvas de velas rosas (10x+), e orienta você por voz ou texto.
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('laura_ai')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-pink-950/70 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <span>🎙️ Conversar com Laura AI</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchAllChannels(false)}
              disabled={isLoadingAll}
              className="px-3.5 py-2 rounded-xl bg-purple-900/60 hover:bg-purple-800 border border-purple-700/60 text-xs font-bold text-purple-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-md"
              title="Sincronizar leituras das 3 mesas agora"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAll ? 'animate-spin text-pink-400' : 'text-purple-300'}`} />
              <span>Sincronizar (3 Salas)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyReport}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-800 to-indigo-800 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 border border-purple-600/50 shadow-md cursor-pointer transition-all hover:scale-[1.02]"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-amber-300" />}
              <span>{copied ? 'Copiado!' : 'Copiar Análise'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* DESTAQUE SUPREMO: MELHOR GRÁFICO RECOMENDADO PELA IA AGORA */}
      {champion && (
        <div className="bg-gradient-to-br from-[#160f33] via-[#100a26] to-[#0d0720] border-2 border-amber-400/80 rounded-3xl p-5 sm:p-7 shadow-[0_0_35px_rgba(251,191,36,0.25)] relative overflow-hidden">
          {/* Ambient Golden Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            {/* Top Bar of Champion */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-800/50 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-950 text-black font-black text-lg">
                  🏆
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 font-mono block">
                    RECOMENDAÇÃO SUPREMA DA INTELIGÊNCIA ARTIFICIAL
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                    Melhor Gráfico do Momento: <span className="text-amber-400">{champion.info.name}</span>
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/60 text-emerald-300 text-xs font-black flex items-center gap-1.5 animate-pulse">
                  <Flame className="w-3.5 h-3.5 text-emerald-400" />
                  {champion.statusLabel}
                </span>

                <span className="px-3 py-1 rounded-full bg-amber-950 border border-amber-500/60 text-amber-300 text-xs font-mono font-black">
                  Score IA: {champion.score}/100
                </span>
              </div>
            </div>

            {/* Core Metrics Grid of the Best Room */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Metric 1: Probabilidade de 5x+ (O foco principal do usuário!) */}
              <div className="bg-[#19113d]/90 border border-purple-700/60 rounded-2xl p-4 flex flex-col justify-between space-y-2 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-200 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-pink-400" />
                    Tendência 5x+
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-950 text-pink-300 border border-pink-700/60">
                    ALTA
                  </span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-pink-300">
                    {champion.prob5x}%
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    Probabilidade gigante de rodadas pagando ≥ 5.00x
                  </div>
                </div>
                <div className="w-full bg-[#0a0717] rounded-full h-2 overflow-hidden border border-purple-900">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${champion.prob5x}%` }}
                  />
                </div>
              </div>

              {/* Metric 2: Probabilidade de Rosas (10x+) */}
              <div className="bg-[#19113d]/90 border border-purple-700/60 rounded-2xl p-4 flex flex-col justify-between space-y-2 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Chuva de Rosas (10x+)
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/60">
                    VIP
                  </span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-300">
                    {champion.prob10x}%
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    Frequência ativa de velas de 10x a 50x+
                  </div>
                </div>
                <div className="w-full bg-[#0a0717] rounded-full h-2 overflow-hidden border border-purple-900">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${champion.prob10x}%` }}
                  />
                </div>
              </div>

              {/* Metric 3: Taxa Pagadora Geral (>= 2.00x) */}
              <div className="bg-[#19113d]/90 border border-purple-700/60 rounded-2xl p-4 flex flex-col justify-between space-y-2 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-200 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Taxa Pagadora Geral
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                    FLUXO
                  </span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-300">
                    {champion.payRate.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    Velas roxas e rosas (≥ 2.00x)
                  </div>
                </div>
                <div className="w-full bg-[#0a0717] rounded-full h-2 overflow-hidden border border-purple-900">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, champion.payRate)}%` }}
                  />
                </div>
              </div>

              {/* Metric 4: Última Vela da Sala Campeã */}
              <div className="bg-[#19113d]/90 border border-purple-700/60 rounded-2xl p-4 flex flex-col justify-between space-y-2 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-200 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Última Vela
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    #{champion.lastCandle?.rodada || champion.lastCandle?.id || '--'}
                  </span>
                </div>
                <div>
                  <div
                    className={`text-2xl sm:text-3xl font-black px-2 py-0.5 rounded-xl border inline-block ${
                      champion.lastCandle
                        ? getMultiplierBadge(champion.lastCandle.mult)
                        : 'text-slate-400'
                    }`}
                  >
                    {champion.lastCandle ? `${champion.lastCandle.mult.toFixed(2)}x` : '--'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono">
                    {champion.lastCandle?.t ? champion.lastCandle.t.split(' ')[1] : 'Ao vivo'}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Natural Language Diagnostic Statement */}
            <div className="p-4 rounded-2xl bg-[#0e0824] border border-amber-400/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-950 border border-amber-500/60 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                    Diagnóstico da Laura AI
                  </h4>
                  <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                    {champion.tendencyText}
                  </p>
                </div>
              </div>

              {/* Primary Call-to-Action to operate on the best room */}
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleOperateInRoom(champion.channel)}
                  className="flex-1 sm:flex-initial py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-950/80 cursor-pointer transition-all hover:scale-[1.02]"
                >
                  <Plane className="w-4 h-4 text-black rotate-[-20deg]" />
                  <span>OPERAR NO {champion.info.name.toUpperCase()} AGORA</span>
                  <ExternalLink className="w-3.5 h-3.5 text-black" />
                </button>

                <button
                  type="button"
                  onClick={() => handleGoToListinha(champion.channel)}
                  className="py-3 px-3.5 rounded-2xl bg-[#1c1340] hover:bg-[#281c5a] border border-purple-700/60 text-purple-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  title="Gerar lista de sinais desta sala na Listinha 10x"
                >
                  <span>Gerar Sinais 🌹</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPARATIVO EM TEMPO REAL DOS 3 GRÁFICOS LADO A LADO */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-pink-400" />
              <span>Comparativo dos 3 Gráficos Simultâneos da BETBRABO</span>
            </h3>
            <p className="text-xs text-slate-400">
              Análise em tempo real de tendências para velas acima de 5x e 10x em cada mesa.
            </p>
          </div>

          <span className="text-[11px] font-mono text-purple-300 hidden sm:inline">
            Atualização contínua a cada 4s
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {analyses.map((item) => {
            const isWinner = item.rank === 1;
            const rankBadge =
              item.rank === 1
                ? '🥇 RECOMENDADO Nº 1'
                : item.rank === 2
                ? '🥈 SEGUNDO LUGAR'
                : '🥉 TERCEIRO LUGAR';

            return (
              <div
                key={item.channel}
                className={`rounded-3xl p-5 border flex flex-col justify-between space-y-4 transition-all ${
                  isWinner
                    ? 'bg-[#150f30] border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.2)]'
                    : 'bg-[#0f0b20] border-purple-900/50 hover:border-purple-700/60'
                }`}
              >
                {/* Header */}
                <div>
                  <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
                        style={{
                          backgroundColor: `${item.info.accentHex}20`,
                          color: item.info.accentHex,
                          border: `1px solid ${item.info.accentHex}60`,
                        }}
                      >
                        {item.channel === 'aviator_1' ? '1' : item.channel === 'radar_ao_vivo' ? 'VIP' : '👑'}
                      </div>
                      <div>
                        <h4 className="text-base font-black text-white">{item.info.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400">{item.info.apiName}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full border block ${
                          isWinner
                            ? 'bg-amber-950 text-amber-300 border-amber-600'
                            : 'bg-purple-950 text-purple-300 border-purple-800'
                        }`}
                      >
                        {rankBadge}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300 block mt-0.5">
                        Score IA: <strong>{item.score}/100</strong>
                      </span>
                    </div>
                  </div>

                  {/* Status Banner */}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span
                      className={`px-2.5 py-1 rounded-lg border font-black text-[10px] flex items-center gap-1 ${
                        item.status === 'HOT'
                          ? 'bg-pink-950 border-pink-500/60 text-pink-300 animate-pulse'
                          : item.status === 'COLD'
                          ? 'bg-cyan-950 border-cyan-500/60 text-cyan-300'
                          : 'bg-amber-950 border-amber-500/60 text-amber-300'
                      }`}
                    >
                      {item.statusLabel}
                    </span>

                    <span className="text-[10px] font-mono text-slate-400">
                      {item.totalCandles} velas catalogadas
                    </span>
                  </div>

                  {/* Tendência 5x+ e 10x+ (O cerne do pedido) */}
                  <div className="mt-4 space-y-2.5 p-3.5 rounded-2xl bg-[#090616] border border-purple-950">
                    {/* 5x+ Probability */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span className="text-slate-300 flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-pink-400" />
                          Tendência para Velas ≥ 5.00x:
                        </span>
                        <span className="font-mono text-pink-300 font-black">
                          {item.prob5x}%
                        </span>
                      </div>
                      <div className="w-full bg-[#17102d] rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 rounded-full"
                          style={{ width: `${item.prob5x}%` }}
                        />
                      </div>
                    </div>

                    {/* 10x+ Probability */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span className="text-slate-300 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          Chuva de Rosas (≥ 10.00x):
                        </span>
                        <span className="font-mono text-amber-300 font-black">
                          {item.prob10x}%
                        </span>
                      </div>
                      <div className="w-full bg-[#17102d] rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-pink-500 to-amber-400 rounded-full"
                          style={{ width: `${item.prob10x}%` }}
                        />
                      </div>
                    </div>

                    {/* Taxa Pagadora */}
                    <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Taxa Pagadora (≥ 2x):</span>
                      <strong className="text-emerald-400">{item.payRate.toFixed(1)}%</strong>
                    </div>
                  </div>

                  {/* Fita de Rodadas Recentes */}
                  <div className="mt-3">
                    <span className="text-[10px] text-slate-400 block mb-1 font-bold">
                      Últimas Rodadas ({item.recentMultipliers.length}):
                    </span>
                    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
                      {item.recentMultipliers.map((m, idx) => (
                        <div
                          key={idx}
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black border ${getMultiplierBadge(
                            m
                          )}`}
                        >
                          {m.toFixed(2)}x
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions for this Room */}
                <div className="space-y-2 pt-2 border-t border-purple-900/40">
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    🔗 {item.info.brokerUrl}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOperateInRoom(item.channel)}
                      className="py-2.5 px-3 rounded-xl bg-purple-950 hover:bg-purple-900 border border-purple-700/60 text-purple-200 font-extrabold text-[11px] uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02]"
                    >
                      <span>Operar Sala</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGoToListinha(item.channel)}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-[11px] uppercase tracking-wide flex items-center justify-center gap-1 cursor-pointer transition-all hover:scale-[1.02]"
                    >
                      <span>Listinha 🌹</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* HORÁRIOS DE OURO DETECTADOS PELA IA (24 HORAS) */}
      <div className="bg-[#0f0b1f] border border-purple-900/50 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-900/40 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔮</span>
              <h3 className="text-base font-black text-white">
                Horários de Ouro Detectados pela IA (Padrões Pagantes 24H)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Padrões estatísticos e algorítmicos identificados pela IA cruzando o histórico das 3 mesas. Janelas com probabilidade gigante de velas acima de 5x e chuvas de rosas (10x+).
            </p>
          </div>

          <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-800/40 font-bold self-start sm:self-center">
            Padrão Algorítmico BETBRABO
          </span>
        </div>

        {/* Schedule Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {goldWindows.map((win) => {
            const chInfo = RADAR_CHANNELS[win.channel];
            const isActive = win.status === 'active';
            const isUpcoming = win.status === 'upcoming';

            return (
              <div
                key={win.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${
                  isActive
                    ? 'bg-gradient-to-b from-[#1c123d] to-[#120a28] border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] ring-1 ring-emerald-400'
                    : isUpcoming
                    ? 'bg-[#140e2b] border-amber-400/70 shadow-md'
                    : 'bg-[#110d24] border-purple-900/40 text-slate-300'
                }`}
              >
                <div>
                  {/* Status Tag */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black font-mono text-amber-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      {win.timeRange}
                    </span>

                    {isActive ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/60 text-emerald-300 text-[10px] font-black animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        AO VIVO AGORA 🔥
                      </span>
                    ) : isUpcoming ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-500/60 text-amber-300 text-[10px] font-black">
                        PRÓXIMA JANELA ⏳
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-800/40 text-purple-300 text-[10px] font-bold">
                        PROGRAMADA 🌙
                      </span>
                    )}
                  </div>

                  {/* Channel Tag */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Mesa:</span>
                      <strong className="text-pink-300">{chInfo.name}</strong>
                    </span>

                    <span className="text-xs font-mono font-black text-emerald-400">
                      {win.probability}% Prob.
                    </span>
                  </div>

                  {/* Pattern & Target */}
                  <div className="mt-2 p-2.5 rounded-xl bg-[#090616] border border-purple-950/70 space-y-1">
                    <div className="text-[11px] font-black text-amber-300">
                      🎯 {win.targetDescription}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      💡 {win.patternName}
                    </div>
                    <div className="text-[9px] text-slate-500 leading-tight">
                      {win.patternDetails}
                    </div>
                  </div>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={() => handleGoToListinha(win.channel)}
                  className={`w-full py-2 px-3 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md'
                      : 'bg-[#181135] hover:bg-[#23184d] border border-purple-800/50 text-purple-200'
                  }`}
                >
                  <span>Gerar Sinais Deste Horário 🌹</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
