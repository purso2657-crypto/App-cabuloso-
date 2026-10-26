import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AviatorCandle,
  AviatorFeedChannel,
  RadarApiResponse,
  RadarAviatorCandle,
  RadarMomento,
} from '../types';
import {
  fetchRadarBroadcast,
  convertRadarHistoryToCandles,
  mergeCandles,
  RADAR_DEFAULT_CASA,
  RADAR_CHANNELS,
} from '../utils/radarApi';
import { LiveMultiplierChart } from './LiveMultiplierChart';
import { exportCandlesToCSV, downloadCSVFile } from '../utils/pdfParser';
import {
  Radio,
  RefreshCw,
  Flame,
  Snowflake,
  Zap,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ExternalLink,
  Download,
  Send,
  Sliders,
  Play,
  Square,
  Sparkles,
  Layers,
  Crown,
  Grid,
  Plane,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface RadarLiveViewProps {
  candles: AviatorCandle[];
  initialChannel?: AviatorFeedChannel;
  onLoadCandlesToMain: (newCandles: AviatorCandle[], sourceName: string) => void;
  onNavigateToTab: (tab: 'correcao' | 'listinha_10x') => void;
  showToast: (msg: string) => void;
}

type ViewMode = 'single' | 'comparative';

export const RadarLiveView: React.FC<RadarLiveViewProps> = ({
  candles,
  initialChannel = 'aviator_1',
  onLoadCandlesToMain,
  onNavigateToTab,
  showToast,
}) => {
  const [activeChannel, setActiveChannel] = useState<AviatorFeedChannel>(initialChannel);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [casa, setCasa] = useState<string>(RADAR_DEFAULT_CASA);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAutoSync, setIsAutoSync] = useState<boolean>(true);
  const [syncIntervalSeconds, setSyncIntervalSeconds] = useState<number>(3);
  const [countdown, setCountdown] = useState<number>(3);

  // Per-channel state store
  const [channelData, setChannelData] = useState<
    Record<
      AviatorFeedChannel,
      {
        response: RadarApiResponse | null;
        accumulatedCandles: AviatorCandle[];
        lastSync: Date | null;
        error: string | null;
      }
    >
  >({
    aviator_1: { response: null, accumulatedCandles: [], lastSync: null, error: null },
    radar_ao_vivo: { response: null, accumulatedCandles: [], lastSync: null, error: null },
    aviator_premium: { response: null, accumulatedCandles: [], lastSync: null, error: null },
  });

  const timerRef = useRef<any>(null);
  const countdownRef = useRef<any>(null);

  // Keep activeChannel in sync if initialChannel changes from sidebar
  useEffect(() => {
    if (initialChannel) {
      setActiveChannel(initialChannel);
    }
  }, [initialChannel]);

  // Fetch a specific channel
  const fetchSingleChannel = useCallback(
    async (ch: AviatorFeedChannel, isSilent = false) => {
      if (!isSilent) setIsLoading(true);

      try {
        const response = await fetchRadarBroadcast(ch, casa);
        const liveCandles = response.historico
          ? convertRadarHistoryToCandles(response.historico, ch.toUpperCase())
          : [];

        setChannelData((prev) => {
          const current = prev[ch];
          const newAccumulated =
            current.accumulatedCandles.length === 0
              ? liveCandles
              : mergeCandles(current.accumulatedCandles, liveCandles);

          return {
            ...prev,
            [ch]: {
              response,
              accumulatedCandles: newAccumulated,
              lastSync: new Date(),
              error: null,
            },
          };
        });
      } catch (err: any) {
        setChannelData((prev) => ({
          ...prev,
          [ch]: {
            ...prev[ch],
            error: err?.message || `Erro ao conectar com ${RADAR_CHANNELS[ch]?.name}.`,
          },
        }));
      } finally {
        if (!isSilent) setIsLoading(false);
      }
    },
    [casa]
  );

  // Fetch all channels if comparative mode, or activeChannel if single mode
  const fetchActiveChannels = useCallback(
    async (isSilent = false) => {
      if (viewMode === 'comparative') {
        await Promise.all([
          fetchSingleChannel('aviator_1', isSilent),
          fetchSingleChannel('radar_ao_vivo', isSilent),
          fetchSingleChannel('aviator_premium', isSilent),
        ]);
      } else {
        await fetchSingleChannel(activeChannel, isSilent);
      }
    },
    [viewMode, activeChannel, fetchSingleChannel]
  );

  // Trigger on channel change or viewMode change
  useEffect(() => {
    fetchActiveChannels(false);
  }, [fetchActiveChannels]);

  // Auto-sync interval timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (isAutoSync) {
      setCountdown(syncIntervalSeconds);

      countdownRef.current = setInterval(() => {
        setCountdown((prev) => (prev <= 1 ? syncIntervalSeconds : prev - 1));
      }, 1000);

      timerRef.current = setInterval(() => {
        fetchActiveChannels(true);
      }, syncIntervalSeconds * 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isAutoSync, syncIntervalSeconds, fetchActiveChannels]);

  // Send accumulated candles of a channel to main app
  const handleApplyToApp = (
    ch: AviatorFeedChannel,
    destination?: 'correcao' | 'listinha_10x'
  ) => {
    const candlesToApply = channelData[ch]?.accumulatedCandles || [];
    if (candlesToApply.length === 0) {
      showToast('Nenhuma vela disponível para esta sala ainda.');
      return;
    }

    const channelInfo = RADAR_CHANNELS[ch];
    const sourceName = `API_BETBRABO_${channelInfo.shortName.replace(/\s+/g, '_')}_AO_VIVO.csv`;
    onLoadCandlesToMain(candlesToApply, sourceName);
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    showToast(
      `${candlesToApply.length} velas de ${channelInfo.name} carregadas no Analista Bravo!`
    );

    if (destination) {
      onNavigateToTab(destination);
    }
  };

  // Export CSV for a specific channel
  const handleExportChannelCSV = (ch: AviatorFeedChannel) => {
    const candlesToExport = channelData[ch]?.accumulatedCandles || [];
    if (candlesToExport.length === 0) {
      showToast('Nenhuma vela para exportar.');
      return;
    }
    const channelInfo = RADAR_CHANNELS[ch];
    const csvData = exportCandlesToCSV(candlesToExport);
    downloadCSVFile(csvData, `historico_${channelInfo.id}_betbrabo.csv`);
    showToast(`Histórico de ${channelInfo.name} baixado em .CSV!`);
  };

  // Helper colors for multipliers
  const getMultiplierColor = (mult: number) => {
    if (mult >= 50.0)
      return 'bg-amber-400 text-black border-amber-300 font-black shadow-[0_0_12px_rgba(251,191,36,0.6)]';
    if (mult >= 10.0)
      return 'bg-pink-600 text-white border-pink-400 font-extrabold shadow-[0_0_10px_rgba(236,72,153,0.5)]';
    if (mult >= 2.0) return 'bg-purple-600 text-white border-purple-400 font-bold';
    return 'bg-blue-600/90 text-white border-blue-400 font-medium';
  };

  // Active channel details
  const activeChannelInfo = RADAR_CHANNELS[activeChannel];
  const activeStore = channelData[activeChannel];
  const activeResponse = activeStore.response;
  const momento = activeResponse?.momento;
  const ultimaVela = activeResponse?.ultimaVela;
  const historico = activeResponse?.historico || [];
  const accumulated = activeStore.accumulatedCandles;
  const lastSyncTime = activeStore.lastSync;

  // Determine Estado visual
  const estado = (momento?.estado || 'normal').toLowerCase();
  const isPagando = estado.includes('pagando');
  const isRecolhendo = estado.includes('recolhendo');

  const estadoBadge = isPagando ? (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-pink-950/80 border border-pink-500/70 text-pink-300 font-black text-xs animate-pulse shadow-[0_0_15px_rgba(236,72,153,0.3)]">
      <Flame className="w-3.5 h-3.5 text-pink-400 animate-bounce" />
      <span>MOMENTO PAGANDO 🔥</span>
    </div>
  ) : isRecolhendo ? (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-950/80 border border-cyan-500/70 text-cyan-300 font-black text-xs shadow-[0_0_15px_rgba(6,182,212,0.3)]">
      <Snowflake className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
      <span>MOMENTO RECOLHENDO ❄️</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-950/80 border border-amber-500/70 text-amber-300 font-black text-xs">
      <Zap className="w-3.5 h-3.5 text-amber-400" />
      <span>MOMENTO EQUILIBRADO ⚡</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Bar: Channel & View Mode Selector */}
      <div className="bg-[#100c24] border border-purple-800/50 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          {/* Channel Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-purple-300/80 mr-1 flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              Gráficos:
            </span>

            {/* Aviator 1 Tab */}
            <button
              type="button"
              onClick={() => {
                setViewMode('single');
                setActiveChannel('aviator_1');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
                viewMode === 'single' && activeChannel === 'aviator_1'
                  ? 'bg-cyan-950 border-cyan-400 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'bg-[#150f30] border-purple-900/50 text-slate-300 hover:border-cyan-600/60 hover:text-white'
              }`}
            >
              <Plane className="w-3.5 h-3.5 text-cyan-400" />
              <span>Aviator 1</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-900/80 text-cyan-300 border border-cyan-700/60">
                Sala 1
              </span>
            </button>

            {/* Aviator 2 / Radar Ao Vivo Tab */}
            <button
              type="button"
              onClick={() => {
                setViewMode('single');
                setActiveChannel('radar_ao_vivo');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
                viewMode === 'single' && activeChannel === 'radar_ao_vivo'
                  ? 'bg-purple-950 border-purple-400 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                  : 'bg-[#150f30] border-purple-900/50 text-slate-300 hover:border-purple-600/60 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span>Aviator 2</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900/80 text-purple-300 border border-purple-700/60">
                Radar
              </span>
            </button>

            {/* Aviator Premium Tab */}
            <button
              type="button"
              onClick={() => {
                setViewMode('single');
                setActiveChannel('aviator_premium');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
                viewMode === 'single' && activeChannel === 'aviator_premium'
                  ? 'bg-amber-950 border-amber-400 text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                  : 'bg-[#150f30] border-purple-900/50 text-slate-300 hover:border-amber-600/60 hover:text-white'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Aviator Premium</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-900/80 text-amber-300 border border-amber-700/60">
                VIP
              </span>
            </button>

            {/* Comparativo 3 Gráficos Tab */}
            <button
              type="button"
              onClick={() => setViewMode('comparative')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
                viewMode === 'comparative'
                  ? 'bg-pink-950 border-pink-400 text-pink-200 shadow-[0_0_15px_rgba(236,72,153,0.4)]'
                  : 'bg-[#150f30] border-purple-900/50 text-slate-300 hover:border-pink-600/60 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5 text-pink-400" />
              <span>Comparativo (3 Gráficos)</span>
            </button>
          </div>

          {/* Sync & Refresh Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Auto-Sync Toggle */}
            <button
              type="button"
              onClick={() => setIsAutoSync(!isAutoSync)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                isAutoSync
                  ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {isAutoSync ? (
                <Square className="w-3 h-3 text-emerald-400 fill-emerald-400" />
              ) : (
                <Play className="w-3 h-3 text-slate-300" />
              )}
              <span>{isAutoSync ? `Ao Vivo (${countdown}s)` : 'Pausado'}</span>
            </button>

            {/* Interval Picker */}
            <select
              value={syncIntervalSeconds}
              onChange={(e) => setSyncIntervalSeconds(Number(e.target.value))}
              className="bg-[#171131] border border-purple-800/60 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-purple-200 outline-none cursor-pointer"
            >
              <option value={2}>2 segundos</option>
              <option value={3}>3 segundos</option>
              <option value={5}>5 segundos</option>
              <option value={8}>8 segundos</option>
            </select>

            {/* Manual Refresh */}
            <button
              type="button"
              onClick={() => fetchActiveChannels(false)}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl bg-purple-900/60 hover:bg-purple-800/80 border border-purple-700/60 text-xs font-bold text-purple-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Atualizar agora"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-pink-400' : 'text-purple-300'}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Subheader info line */}
        <div className="mt-3 pt-3 border-t border-purple-900/40 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-300 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white">
              {viewMode === 'comparative'
                ? 'Modo Multitelas: Monitorando 3 feeds simultâneos da BETBRABO'
                : `${activeChannelInfo.title} • Feed: ${activeChannelInfo.apiName}`}
            </span>
            <span className="text-[10px] text-amber-300 font-mono bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
              CASA: {casa}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            {lastSyncTime ? (
              <span>Última sincronização: {lastSyncTime.toLocaleTimeString('pt-BR')}</span>
            ) : (
              <span>Conectando aos servidores...</span>
            )}
          </div>
        </div>
      </div>

      {/* COMPARATIVE VIEW: 3 Live Charts Side by Side */}
      {viewMode === 'comparative' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {(['aviator_1', 'radar_ao_vivo', 'aviator_premium'] as AviatorFeedChannel[]).map((ch) => {
              const chInfo = RADAR_CHANNELS[ch];
              const store = channelData[ch];
              const r = store.response;
              const chMomento = r?.momento;
              const chUltima = r?.ultimaVela;
              const chCandles = store.accumulatedCandles;
              const chEstado = (chMomento?.estado || 'normal').toLowerCase();

              return (
                <div
                  key={ch}
                  className="bg-[#0e0a22] border border-purple-900/50 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between space-y-4"
                >
                  {/* Channel Header */}
                  <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs"
                        style={{
                          backgroundColor: `${chInfo.accentHex}20`,
                          color: chInfo.accentHex,
                          border: `1px solid ${chInfo.accentHex}60`,
                        }}
                      >
                        {ch === 'aviator_1' ? '1' : ch === 'radar_ao_vivo' ? '2' : '👑'}
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-white">{chInfo.name}</h3>
                        <span className="text-[10px] font-mono text-slate-400">{chInfo.apiName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {chEstado.includes('pagando') ? (
                        <span className="px-2 py-0.5 rounded-lg bg-pink-950 border border-pink-500/60 text-pink-300 text-[10px] font-black animate-pulse">
                          PAGANDO 🔥
                        </span>
                      ) : chEstado.includes('recolhendo') ? (
                        <span className="px-2 py-0.5 rounded-lg bg-cyan-950 border border-cyan-500/60 text-cyan-300 text-[10px] font-black">
                          RECOLHENDO ❄️
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-950 border border-amber-500/60 text-amber-300 text-[10px] font-black">
                          EQUILIBRADO ⚡
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Última Vela & Score */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-[#140e2d] border border-purple-800/40">
                    <div>
                      <span className="text-[9px] uppercase font-mono text-slate-400 block">
                        Última Vela
                      </span>
                      <span
                        className={`text-2xl font-black px-2 py-0.5 rounded-xl border ${
                          chUltima ? getMultiplierColor(chUltima.mult) : 'text-slate-400'
                        }`}
                      >
                        {chUltima ? `${chUltima.mult.toFixed(2)}x` : '--'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block font-mono">
                        Velas Acumuladas
                      </span>
                      <span className="text-base font-black font-mono text-emerald-400">
                        {chCandles.length.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-pink-300 block font-mono">
                        {chCandles.filter((c) => c.multiplier >= 10).length} Rosas (10x+)
                      </span>
                    </div>
                  </div>

                  {/* Chart */}
                  <LiveMultiplierChart
                    candles={chCandles}
                    title={chInfo.name}
                    badge={chInfo.badge}
                    accentColor={chInfo.accentHex}
                    compact={true}
                  />

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-purple-900/30">
                    <button
                      type="button"
                      onClick={() => handleApplyToApp(ch, 'correcao')}
                      disabled={chCandles.length === 0}
                      className="py-2 px-3 rounded-xl bg-purple-950 hover:bg-purple-900/70 border border-purple-700/60 text-purple-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3 h-3 text-emerald-400" />
                      <span>Auditar Correção</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyToApp(ch, 'listinha_10x')}
                      disabled={chCandles.length === 0}
                      className="py-2 px-3 rounded-xl bg-pink-950 hover:bg-pink-900/70 border border-pink-700/60 text-pink-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Flame className="w-3 h-3 text-pink-400" />
                      <span>Listinha 10x</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* SINGLE CHANNEL VIEW: Rich Multiplier Chart + Analysis */
        <div className="space-y-6">
          {/* Main Interactive Chart Component */}
          <LiveMultiplierChart
            candles={accumulated}
            title={activeChannelInfo.title}
            badge={activeChannelInfo.badge}
            accentColor={activeChannelInfo.accentHex}
          />

          {/* Grid: Momento Analítico (Left) + Última Vela & Fita ao Vivo (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Momento do Mercado */}
            <div className="lg:col-span-5 bg-[#0e0a1e] border border-purple-900/40 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-purple-900/40">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-pink-400" />
                  <h3 className="text-sm font-extrabold text-white">Leitura de Momento</h3>
                </div>
                {estadoBadge}
              </div>

              {/* Scores: Pagantes vs Azuis */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-purple-300 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-pink-400" />
                    Score Pagantes (≥ 2x):
                  </span>
                  <span className="font-mono text-pink-300 text-sm font-black">
                    {momento?.score_pagantes !== undefined ? momento.score_pagantes : '--'}
                  </span>
                </div>

                <div className="w-full bg-slate-900 rounded-full h-3.5 overflow-hidden p-0.5 border border-purple-900/60 flex">
                  <div
                    className="bg-gradient-to-r from-purple-500 via-pink-500 to-rose-400 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        momento
                          ? Math.min(
                              100,
                              Math.max(
                                5,
                                (momento.score_pagantes /
                                  Math.max(1, momento.score_pagantes + momento.score_azuis)) *
                                  100
                              )
                            )
                          : 50
                      }%`,
                    }}
                  />
                  <div
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        momento
                          ? Math.min(
                              100,
                              Math.max(
                                5,
                                (momento.score_azuis /
                                  Math.max(1, momento.score_pagantes + momento.score_azuis)) *
                                  100
                              )
                            )
                          : 50
                      }%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-blue-300 flex items-center gap-1">
                    <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
                    Score Azuis (&lt; 2x):
                  </span>
                  <span className="font-mono text-cyan-300 text-sm font-black">
                    {momento?.score_azuis !== undefined ? momento.score_azuis : '--'}
                  </span>
                </div>
              </div>

              {/* Regra 3 Azuis Indicator */}
              {momento?.regra_3_azuis !== undefined && (
                <div
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold ${
                    momento.regra_3_azuis
                      ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-200'
                      : 'bg-purple-950/40 border-purple-800/40 text-purple-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle
                      className={`w-4 h-4 ${momento.regra_3_azuis ? 'text-cyan-400' : 'text-purple-400'}`}
                    />
                    Gatilho Regra 3 Azuis:
                  </span>
                  <span className="font-black px-2 py-0.5 rounded bg-black/40">
                    {momento.regra_3_azuis ? 'ATIVO (Recolhendo) ⚠️' : 'Inativo ✅'}
                  </span>
                </div>
              )}

              {/* Motivos da Leitura */}
              <div className="space-y-2 pt-2 border-t border-purple-900/30">
                <label className="text-xs font-bold text-slate-300 block">
                  Motivos da Análise Analítica:
                </label>
                {momento?.motivos && momento.motivos.length > 0 ? (
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {momento.motivos.map((motivo, idx) => (
                      <li
                        key={idx}
                        className="text-[11px] font-mono text-slate-300 bg-[#16112a] border border-purple-900/30 px-3 py-1.5 rounded-xl flex items-start gap-2"
                      >
                        <span className="text-pink-400 font-bold shrink-0">•</span>
                        <span>{motivo}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    Aguardando leitura de motivos do broadcast...
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Última Vela + Fita ao Vivo + Ações */}
            <div className="lg:col-span-7 bg-[#0e0a1e] border border-purple-900/40 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between space-y-6">
              <div>
                {/* Top Row: Última Vela Card */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#15102a] border border-purple-800/40">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block mb-1">
                      Última Rodada Finalizada ({activeChannelInfo.shortName})
                    </span>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-3xl sm:text-4xl font-black px-3.5 py-1 rounded-2xl border ${
                          ultimaVela ? getMultiplierColor(ultimaVela.mult) : 'text-slate-400 bg-slate-900'
                        }`}
                      >
                        {ultimaVela ? `${ultimaVela.mult.toFixed(2)}x` : '--'}
                      </span>
                      <div>
                        <div className="text-xs font-mono text-slate-300 font-bold">
                          {ultimaVela ? `Rodada #${ultimaVela.rodada || ultimaVela.id}` : 'Sem dados'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>{ultimaVela?.t || '--:--:--'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Accumulated Stats in Session */}
                  <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 w-full sm:w-auto">
                    <span className="text-[10px] text-slate-400 block">Velas Acumuladas</span>
                    <span className="text-xl font-mono font-black text-emerald-400">
                      {accumulated.length.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-pink-300 block">
                      {accumulated.filter((c) => c.multiplier >= 10.0).length} Rosas (10x+)
                    </span>
                  </div>
                </div>

                {/* Fita de Velas Recentes */}
                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-pink-400" />
                      <span>Fita de Velas Recentes ({historico.length})</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Mais recentes à esquerda</span>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                    {historico.length > 0 ? (
                      historico.map((v, i) => (
                        <div
                          key={`${v.id}_${i}`}
                          className={`shrink-0 px-2.5 py-1.5 rounded-xl border text-center transition-all ${getMultiplierColor(
                            v.mult
                          )}`}
                        >
                          <div className="text-xs font-black">{v.mult.toFixed(2)}x</div>
                          <div className="text-[9px] opacity-75 font-mono">
                            {v.t ? v.t.split(' ')[1] || v.t : ''}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-500 w-full">
                        Aguardando velas do feed ao vivo...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-purple-900/40 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Transferir Dados de {activeChannelInfo.name} para Ferramentas:</span>
                  <button
                    type="button"
                    onClick={() => handleExportChannelCSV(activeChannel)}
                    disabled={accumulated.length === 0}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono cursor-pointer disabled:opacity-40"
                  >
                    <Download className="w-3 h-3" />
                    <span>Baixar CSV</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleApplyToApp(activeChannel, 'correcao')}
                    disabled={accumulated.length === 0}
                    className="py-3 px-4 rounded-2xl bg-[#191336] hover:bg-[#251d4e] border border-emerald-600/50 hover:border-emerald-400 text-emerald-200 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 text-emerald-400" />
                    <span>Auditar na Correção Brava</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyToApp(activeChannel, 'listinha_10x')}
                    disabled={accumulated.length === 0}
                    className="py-3 px-4 rounded-2xl bg-[#191336] hover:bg-[#251d4e] border border-pink-600/50 hover:border-pink-400 text-pink-200 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md disabled:opacity-50"
                  >
                    <Flame className="w-4 h-4 text-pink-400" />
                    <span>Gerar Listinha 10x 🌹</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
