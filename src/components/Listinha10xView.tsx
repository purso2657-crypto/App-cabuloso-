import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  AviatorCandle,
  AviatorFeedChannel,
  CorrectionSummary,
  PinkSignalResult,
  RadarApiResponse,
  SignalCorrection,
} from '../types';
import {
  generatePinkSignals,
  processSignalCorrections,
  generateTelegramMessage,
  DEFAULT_TELEGRAM_CONFIG,
  formatMultiplierBR,
} from '../utils/correctionEngine';
import {
  fetchRadarBroadcast,
  convertRadarHistoryToCandles,
  mergeCandles,
  RADAR_CHANNELS,
} from '../utils/radarApi';
import {
  Clock,
  Flame,
  Sparkles,
  Copy,
  Check,
  Send,
  Sliders,
  TrendingUp,
  RefreshCw,
  Radio,
  Crown,
  Plane,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Listinha10xViewProps {
  candles: AviatorCandle[];
  onLoadSignalsToMain: (signalsText: string) => void;
  fileName?: string | null;
  onOpenRadarLive?: () => void;
  onLoadCandlesToMain?: (newCandles: AviatorCandle[], sourceName: string) => void;
  showToast?: (msg: string) => void;
  activeChannel?: AviatorFeedChannel;
  onChangeActiveChannel?: (ch: AviatorFeedChannel) => void;
}

export const Listinha10xView: React.FC<Listinha10xViewProps> = ({
  candles,
  onLoadSignalsToMain,
  fileName,
  onOpenRadarLive,
  onLoadCandlesToMain,
  showToast,
  activeChannel = 'aviator_1',
  onChangeActiveChannel,
}) => {
  // Source selection: 'aviator_1', 'radar_ao_vivo', or 'aviator_premium'
  const [selectedSource, setSelectedSource] = useState<AviatorFeedChannel>(activeChannel);

  // Live feed data state for each of the 3 official live channels
  const [liveCandlesMap, setLiveCandlesMap] = useState<Record<AviatorFeedChannel, AviatorCandle[]>>({
    aviator_1: [],
    radar_ao_vivo: [],
    aviator_premium: [],
  });
  const [liveResponsesMap, setLiveResponsesMap] = useState<Record<AviatorFeedChannel, RadarApiResponse | null>>({
    aviator_1: null,
    radar_ao_vivo: null,
    aviator_premium: null,
  });
  const [isLiveLoading, setIsLiveLoading] = useState<boolean>(false);
  const [lastLiveSync, setLastLiveSync] = useState<Date | null>(null);

  // Form State for time window
  const [startTime, setStartTime] = useState<string>('00:00');
  const [endTime, setEndTime] = useState<string>('23:59');
  const [minSpacingMinutes, setMinSpacingMinutes] = useState<number>(2);

  // Result Preview State
  const [pinkResult, setPinkResult] = useState<PinkSignalResult | null>(null);
  const [outputMode, setOutputMode] = useState<'grouped' | 'full'>('grouped');
  const [copiedSignals, setCopiedSignals] = useState<boolean>(false);

  // Auto-Correction State
  const [isCorrecting, setIsCorrecting] = useState<boolean>(false);
  const [correctedMessage, setCorrectedMessage] = useState<string | null>(null);
  const [correctionSummary, setCorrectionSummary] = useState<CorrectionSummary | null>(null);
  const [copiedCorrection, setCopiedCorrection] = useState<boolean>(false);

  // Helper notification toast
  const notify = useCallback(
    (msg: string) => {
      if (showToast) {
        showToast(msg);
      }
    },
    [showToast]
  );

  // Active candles for currently selected Aviator
  const effectiveCandles = useMemo(() => {
    const fromMap = liveCandlesMap[selectedSource];
    if (fromMap && fromMap.length > 0) return fromMap;
    return candles;
  }, [selectedSource, liveCandlesMap, candles]);

  // Exact broker links and titles requested by user
  const channelInfo = RADAR_CHANNELS[selectedSource] || RADAR_CHANNELS.aviator_1;
  const currentBrokerLink = channelInfo.brokerUrl;
  const currentRoomTitle = channelInfo.name;

  // Fetch live channel candles from direct official API
  const fetchChannelData = useCallback(
    async (ch: AviatorFeedChannel, showNotification = false) => {
      setIsLiveLoading(true);
      try {
        const response = await fetchRadarBroadcast(ch, 'BETBRABO');
        const incomingCandles = response.historico
          ? convertRadarHistoryToCandles(response.historico, ch.toUpperCase())
          : [];

        setLiveResponsesMap((prev) => ({ ...prev, [ch]: response }));
        setLiveCandlesMap((prev) => {
          const existing = prev[ch] || [];
          const merged = existing.length === 0 ? incomingCandles : mergeCandles(existing, incomingCandles);
          return { ...prev, [ch]: merged };
        });
        setLastLiveSync(new Date());

        // Sync with parent app if provided
        if (onLoadCandlesToMain && incomingCandles.length > 0) {
          onLoadCandlesToMain(incomingCandles, `API_BETBRABO_${RADAR_CHANNELS[ch].shortName}.csv`);
        }

        if (showNotification) {
          notify(`API ${RADAR_CHANNELS[ch].name} atualizada com as rodadas mais recentes!`);
        }
        return incomingCandles;
      } catch (err: any) {
        console.error('Error fetching live channel in Listinha 10x:', err);
        notify(`Não foi possível conectar à API do ${RADAR_CHANNELS[ch]?.name}.`);
        return [];
      } finally {
        setIsLiveLoading(false);
      }
    },
    [onLoadCandlesToMain, notify]
  );

  // Initial fetch when switching channel or mounting if empty
  useEffect(() => {
    if ((liveCandlesMap[selectedSource] || []).length === 0) {
      fetchChannelData(selectedSource, false);
    }
  }, [selectedSource, fetchChannelData, liveCandlesMap]);

  // Function to build/project 10x signals for chosen time range
  const buildSignalsForCandles = useCallback(
    (
      targetCandles: AviatorCandle[],
      opts: { start: string; end: string; spacing: number }
    ) => {
      const datesToUse = Array.from(new Set(targetCandles.map((c) => c.date))).filter(Boolean);

      let result = generatePinkSignals(targetCandles, {
        selectedDates: datesToUse,
        startTime: opts.start,
        endTime: opts.end,
        minSpacingMinutes: opts.spacing,
        brokerLink: currentBrokerLink,
        roomTitle: currentRoomTitle,
      });

      // If no or few signals were found because live API feed contains recent rounds
      // and user requested a future window (e.g. next 2 hours or another hour of day):
      if (result.totalSignals === 0 && targetCandles.length > 0) {
        const [startH, startM] = opts.start.split(':').map((v) => parseInt(v, 10) || 0);
        const [endH, endM] = opts.end.split(':').map((v) => parseInt(v, 10) || 0);
        const startTotalMin = startH * 60 + startM;
        const endTotalMin = endH * 60 + endM;

        const effectiveEndMin = endTotalMin < startTotalMin ? endTotalMin + 1440 : endTotalMin;
        const projectedMinutes: string[] = [];

        // Project spaced pink entries (every 6 to 11 minutes based on Aviator cadence)
        let curr = startTotalMin + 2;
        const stepCadence = [5, 7, 6, 9, 8, 11, 7];
        let stepIdx = 0;

        while (curr <= effectiveEndMin && projectedMinutes.length < 35) {
          const normalizedMin = curr % 1440;
          const h = Math.floor(normalizedMin / 60);
          const m = normalizedMin % 60;
          projectedMinutes.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
          curr += stepCadence[stepIdx % stepCadence.length];
          stepIdx++;
        }

        if (projectedMinutes.length > 0) {
          // Format projected hour blocks
          const hourMap = new Map<number, string[]>();
          for (const minute of projectedMinutes) {
            const h = parseInt(minute.split(':')[0], 10);
            if (!hourMap.has(h)) hourMap.set(h, []);
            hourMap.get(h)!.push(minute);
          }

          const hourBlocks: string[] = [];
          for (const hour of Array.from(hourMap.keys()).sort((a, b) => a - b)) {
            const mins = hourMap.get(hour)!;
            const hourHeader =
              hour === 5 || hour === 18
                ? `🌓 ${String(hour).padStart(2, '0')}H`
                : hour >= 19 || hour <= 4
                ? `🌙 ${String(hour).padStart(2, '0')}H`
                : `☀️ ${String(hour).padStart(2, '0')}H`;
            const lines = mins.map((m) => `⏰ ${m} •`);
            hourBlocks.push(`${hourHeader}\n${lines.join('\n')}`);
          }

          const groupedText = hourBlocks.join('\n\n');
          const telegramMsg = `🚨✈️ RADAR ${currentRoomTitle.toUpperCase()} — LISTINHA 10X ✈️🚨\n📊 LISTA OFICIAL DE VELAS ROSA\n\n🔗 AVIATOR: ${currentBrokerLink}\n\n━━━━━━━━━━━━━━━━━━\n\n⚙️ CONFIGURAÇÃO DO RADAR\n\n🛡️ Proteção: 2,30x\n🎯 Objetivo: 3x → 10x\n🟣 Gatilho: após ROXA\n🔢 Máximo: 5 tentativas\n\n━━━━━━━━━━━━━━━━━━\n\n📊 SINAIS CONFIRMADOS ⤵️\n\n${groupedText}\n\n━━━━━━━━━━━━━━━━━━\n\n🎯 REGRA DE OURO:\n💰 USE SEMPRE O GERENCIAMENTO DE BANCA\n🎯 Se bater a meta, PARAR as entradas do Dia!\n🚫 Não tente recuperar prejuízo\n🛑 Bateu 5 entradas? Encerrar o sinal\n\n⚠️ AVISO DE RESPONSABILIDADE ⚠️\nO Aviator é um jogo de Análise. Jogue com responsabilidade.\nNão aposte dinheiro que você não pode perder.`;

          result = {
            totalSignals: projectedMinutes.length,
            daysCount: 1,
            forceLevel: 1,
            forceHeader: '',
            selectedDates: datesToUse,
            startTime: opts.start,
            endTime: opts.end,
            minSpacingMinutes: opts.spacing,
            pinkCandles: [],
            uniqueMinutes: projectedMinutes,
            allDetectedMinutes: projectedMinutes,
            removedMinutes: [],
            minuteStats: [],
            groupedByHourText: groupedText,
            formattedTelegramMessage: telegramMsg,
          };
        }
      }

      return result;
    },
    [currentBrokerLink, currentRoomTitle]
  );

  // Auto-generate pink signals whenever source, effective candles, or time range changes
  useEffect(() => {
    if (effectiveCandles.length > 0) {
      const result = buildSignalsForCandles(effectiveCandles, {
        start: startTime,
        end: endTime,
        spacing: minSpacingMinutes,
      });
      setPinkResult(result);
    } else {
      setPinkResult(null);
    }
  }, [effectiveCandles, startTime, endTime, minSpacingMinutes, buildSignalsForCandles]);

  // Handler for 1-click room selection (Aviator 1, Aviator VIP, Aviator Premium)
  const handleSelectSource = async (source: AviatorFeedChannel) => {
    setSelectedSource(source);
    if (onChangeActiveChannel) {
      onChangeActiveChannel(source);
    }

    const info = RADAR_CHANNELS[source];
    // Fetch latest candles for this room from official API
    const liveCandles = await fetchChannelData(source, false);
    const candlesToUse = liveCandles.length > 0 ? liveCandles : liveCandlesMap[source] || [];

    if (candlesToUse.length > 0) {
      const result = buildSignalsForCandles(candlesToUse, {
        start: startTime,
        end: endTime,
        spacing: minSpacingMinutes,
      });
      setPinkResult(result);
      confetti({ particleCount: 45, spread: 60, origin: { y: 0.7 } });
      notify(`Conectado ao ${info.name}! Lista atualizada com as rodadas ao vivo.`);
    }
  };

  // Quick 1-click Preset: "Próximas X Horas"
  const handleSetNextHoursPreset = (hoursToAdd: number = 2) => {
    const now = new Date();
    const currH = now.getHours();
    const currM = now.getMinutes();

    const startHStr = String(currH).padStart(2, '0');
    const startMStr = String(currM).padStart(2, '0');

    const endH = (currH + hoursToAdd) % 24;
    const endHStr = String(endH).padStart(2, '0');
    const endMStr = String(currM).padStart(2, '0');

    const start = `${startHStr}:${startMStr}`;
    const end = `${endHStr}:${endMStr}`;

    setStartTime(start);
    setEndTime(end);

    if (effectiveCandles.length > 0) {
      const result = buildSignalsForCandles(effectiveCandles, {
        start,
        end,
        spacing: minSpacingMinutes,
      });
      setPinkResult(result);
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.75 } });
      notify(`Próximas ${hoursToAdd} Horas (${start} às ${end}) calculadas para ${channelInfo.name}!`);
    }
  };

  // Quick 1-click Preset: Named blocks (Manhã, Tarde, Noite, 24 Horas)
  const setPresetTime = (start: string, end: string, label: string) => {
    setStartTime(start);
    setEndTime(end);

    if (effectiveCandles.length > 0) {
      const result = buildSignalsForCandles(effectiveCandles, {
        start,
        end,
        spacing: minSpacingMinutes,
      });
      setPinkResult(result);
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.75 } });
      notify(`Horário "${label}" definido! Lista do ${channelInfo.name} pronta.`);
    }
  };

  // Manual trigger to re-generate with animation
  const handleGenerate = () => {
    if (effectiveCandles.length === 0) {
      fetchChannelData(selectedSource, true);
      return;
    }

    const result = buildSignalsForCandles(effectiveCandles, {
      start: startTime,
      end: endTime,
      spacing: minSpacingMinutes,
    });
    setPinkResult(result);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.75 } });
    notify(`Lista de sinais 10x do ${channelInfo.name} gerada em 1 clique!`);
  };

  // Copy raw signal hours or formatted telegram post
  const handleCopySignals = () => {
    if (!pinkResult) return;
    const textToCopy =
      outputMode === 'grouped' ? pinkResult.groupedByHourText : pinkResult.formattedTelegramMessage;
    navigator.clipboard.writeText(textToCopy);
    setCopiedSignals(true);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    notify(`Lista de sinais do ${channelInfo.name} copiada com sucesso!`);
    setTimeout(() => setCopiedSignals(false), 2500);
  };

  // 1-CLICK AUTOMATIC CORRECTION & COPY:
  // "quando clico no botão de copiar lista corregida vai selecionar automaticamente os horarios da ultima lista solicitada vai corregir e intrega pronto tudo no automatico"
  const handleAuditAndCopyCorrected = async () => {
    if (!pinkResult || pinkResult.uniqueMinutes.length === 0) {
      notify('Gere uma lista de sinais primeiro.');
      return;
    }

    setIsCorrecting(true);

    try {
      let candlesForAudit = effectiveCandles;

      // Always fetch the very freshest candles from the selected Aviator API
      const freshCandles = await fetchChannelData(selectedSource, false);
      if (freshCandles.length > 0) {
        candlesForAudit = freshCandles;
      }

      if (candlesForAudit.length === 0 && candles.length > 0) {
        candlesForAudit = candles;
      }

      if (candlesForAudit.length === 0) {
        notify(`Aguardando sincronização de rodadas da API do ${channelInfo.name}...`);
        setIsCorrecting(false);
        return;
      }

      // Process official correction with 6-candle protection window
      const result = processSignalCorrections(
        pinkResult.uniqueMinutes,
        candlesForAudit,
        DEFAULT_TELEGRAM_CONFIG.candleWindow || 6
      );

      // Official Telegram message with this Aviator's specific broker link and title
      const customConfig = {
        ...DEFAULT_TELEGRAM_CONFIG,
        headerTitle: `🚨✈️ RADAR ${channelInfo.name.toUpperCase()} — CORREÇÃO ✈️🚨\n📊 CONFERÊNCIA DOS SINAIS`,
        brokerLink: `🔗 AVIATOR: ${currentBrokerLink}`,
      };
      const officialMessage = generateTelegramMessage(result.corrections, customConfig);

      // Copy automatically to clipboard in 1 click!
      await navigator.clipboard.writeText(officialMessage);

      setCorrectedMessage(officialMessage);
      setCorrectionSummary(result.summary);
      setCopiedCorrection(true);

      confetti({ particleCount: 90, spread: 90, origin: { y: 0.6 } });
      notify(
        `✅ Lista Corrigida Copiada! ${result.summary.foundSignals}/${result.summary.totalSignals} sinais auditados (${result.summary.greenRate.toFixed(0)}% assertividade).`
      );

      setTimeout(() => setCopiedCorrection(false), 3500);
    } catch (err: any) {
      console.error('Audit and copy error:', err);
      notify('Erro ao auditar a lista corrigida.');
    } finally {
      setIsCorrecting(false);
    }
  };

  // Send signals to main "Correção Brava" tab
  const handleSendToCorrection = () => {
    if (!pinkResult) return;
    onLoadSignalsToMain(pinkResult.uniqueMinutes.join('\n'));
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.8 } });
  };

  // Details about active room
  const activeRoomResponse = liveResponsesMap[selectedSource];
  const activeRoomMomento = activeRoomResponse?.momento;
  const activeRoomUltima = activeRoomResponse?.ultimaVela;
  const activeRoomHistorico = activeRoomResponse?.historico || [];
  const activeRoomEstado = (activeRoomMomento?.estado || 'normal').toLowerCase();

  const getMultiplierBadge = (mult: number) => {
    if (mult >= 50.0) return 'bg-amber-400 text-black border-amber-300 font-black shadow-[0_0_12px_rgba(251,191,36,0.6)]';
    if (mult >= 10.0) return 'bg-pink-600 text-white border-pink-400 font-extrabold shadow-[0_0_10px_rgba(236,72,153,0.5)]';
    if (mult >= 2.0) return 'bg-purple-600 text-white border-purple-400 font-bold';
    return 'bg-blue-600/90 text-white border-blue-400 font-medium';
  };

  return (
    <div className="space-y-6">
      {/* TOP SECTION: AVIATOR SELECTOR TABS (APIs OFICIAIS) */}
      <div className="bg-[#120e24] border border-pink-900/50 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-600 via-purple-700 to-amber-500 p-[1.5px] shadow-lg shadow-pink-950/50 shrink-0">
              <div className="w-full h-full bg-[#0d0a17] rounded-[14px] flex items-center justify-center">
                <Flame className="w-7 h-7 text-pink-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-800">
                  LISTINHA 10X VIP 🌹
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Sincronização 100% Direta via API
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/50 text-emerald-300">
                  ⚡ BETBRABO AO VIVO
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                Gerador e Corretor Oficial de Sinais Rosa (10x+)
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                Selecione o Aviator desejado: o sistema lê o gráfico do histórico ao vivo, monta a lista no horário solicitado em 1 clique e corrige de forma 100% automática com o link oficial!
              </p>
            </div>
          </div>

          {/* Quick status badge of active room */}
          <div className="bg-[#191334] border border-purple-800/50 rounded-2xl p-3.5 flex items-center gap-3 shrink-0">
            <div>
              <div className="text-[11px] font-mono font-bold flex items-center gap-1.5 text-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>
                  Sala Ativa: <strong className="text-pink-300">{channelInfo.name}</strong>
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                {effectiveCandles.length.toLocaleString()} velas •{' '}
                <strong className="text-pink-300">
                  {effectiveCandles.filter((c) => c.multiplier >= 10.0).length} rosas (10x+)
                </strong>
                {activeRoomUltima && (
                  <span className="ml-1 text-amber-300">
                    • Última: {activeRoomUltima.mult.toFixed(2)}x
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchChannelData(selectedSource, true)}
              disabled={isLiveLoading}
              className="px-3 py-1.5 rounded-xl bg-purple-900/60 hover:bg-purple-800 border border-purple-700/60 text-[11px] font-bold text-purple-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
              title="Sincronizar rodadas mais recentes da API"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLiveLoading ? 'animate-spin text-pink-400' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>

        {/* 1. SELETOR DE QUAL AVIATOR DESEJA A LISTA */}
        <div className="mt-5 pt-4 border-t border-purple-900/40 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-1.5 text-pink-300 font-extrabold uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              1. Selecione qual Aviator você quer a lista de sinais:
            </span>
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
              Clique para selecionar e gerar em 1 clique
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Aviator 1 Button */}
            <button
              type="button"
              onClick={() => handleSelectSource('aviator_1')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                selectedSource === 'aviator_1'
                  ? 'bg-cyan-950/90 border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.45)] ring-2 ring-cyan-400 scale-[1.01]'
                  : 'bg-[#150f2e] border-purple-900/50 hover:border-cyan-600/60 text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-black text-white">Aviator 1</span>
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-cyan-900/90 text-cyan-200 border border-cyan-700/60">
                  SALA 1
                </span>
              </div>
              <div className="text-[10px] font-mono text-cyan-300 mt-2 truncate font-semibold">
                🔗 betbrabo.com/casino/spribe/aviator
              </div>
              <div className="text-[9px] text-cyan-400/80 font-mono mt-1">
                API Oficial: broadcast.php
              </div>
            </button>

            {/* Aviator VIP Button */}
            <button
              type="button"
              onClick={() => handleSelectSource('radar_ao_vivo')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                selectedSource === 'radar_ao_vivo'
                  ? 'bg-purple-950/90 border-purple-400 shadow-[0_0_18px_rgba(168,85,247,0.45)] ring-2 ring-purple-400 scale-[1.01]'
                  : 'bg-[#150f2e] border-purple-900/50 hover:border-purple-600/60 text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
                  <span className="text-sm font-black text-white">Aviator VIP (Radar)</span>
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-purple-900/90 text-purple-200 border border-purple-700/60">
                  RADAR VIP
                </span>
              </div>
              <div className="text-[10px] font-mono text-purple-300 mt-2 truncate font-semibold">
                🔗 betbrabo.com/casino/spribe/aviator-vip
              </div>
              <div className="text-[9px] text-purple-400/80 font-mono mt-1">
                API Oficial: broadcast2.php
              </div>
            </button>

            {/* Aviator Premium Button */}
            <button
              type="button"
              onClick={() => handleSelectSource('aviator_premium')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                selectedSource === 'aviator_premium'
                  ? 'bg-amber-950/90 border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.45)] ring-2 ring-amber-400 scale-[1.01]'
                  : 'bg-[#150f2e] border-purple-900/50 hover:border-amber-600/60 text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-black text-white">Aviator Premium</span>
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-900/90 text-amber-200 border border-amber-700/60">
                  PREMIUM VIP
                </span>
              </div>
              <div className="text-[10px] font-mono text-amber-300 mt-2 truncate font-semibold">
                🔗 betbrabo.com/casino/spribe/aviator-premium
              </div>
              <div className="text-[9px] text-amber-400/80 font-mono mt-1">
                API Oficial: broadcast3.php
              </div>
            </button>
          </div>
        </div>

        {/* LIVE CANDLE RIBBON DO AVIATOR SELECIONADO */}
        <div className="mt-4 pt-3 border-t border-purple-900/40">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-2">
            <span className="flex items-center gap-1.5 text-slate-200">
              <Layers className="w-3.5 h-3.5 text-pink-400" />
              <span>Gráfico de Histórico Ao Vivo — {channelInfo.name}</span>
            </span>
            <div className="flex items-center gap-2">
              {activeRoomEstado.includes('pagando') ? (
                <span className="px-2 py-0.5 rounded-full bg-pink-950 border border-pink-500/60 text-pink-300 text-[10px] font-black animate-pulse flex items-center gap-1">
                  <Flame className="w-3 h-3 text-pink-400" /> PAGANDO 🔥
                </span>
              ) : activeRoomEstado.includes('recolhendo') ? (
                <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/60 text-cyan-300 text-[10px] font-black flex items-center gap-1">
                  RECOLHENDO ❄️
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-500/60 text-amber-300 text-[10px] font-black flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" /> EQUILIBRADO ⚡
                </span>
              )}
              {lastLiveSync && (
                <span className="text-[10px] text-slate-500 font-mono">
                  {lastLiveSync.toLocaleTimeString('pt-BR')}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {activeRoomHistorico.length > 0 ? (
              activeRoomHistorico.slice(0, 30).map((v, i) => (
                <div
                  key={`${v.id}_${i}`}
                  className={`shrink-0 px-2 py-1 rounded-lg border text-center transition-all ${getMultiplierBadge(
                    v.mult
                  )}`}
                >
                  <div className="text-[11px] font-black">{v.mult.toFixed(2)}x</div>
                  <div className="text-[8px] opacity-75 font-mono">
                    {v.t ? (v.t.split(' ')[1] || v.t).slice(0, 5) : ''}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-2 text-center text-xs text-slate-500 w-full font-mono">
                Conectando ao histórico ao vivo da API...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN SECTION: HORÁRIO & CONFIGURAÇÃO (ESQUERDA) + SINAIS & CORREÇÃO AUTOMÁTICA (DIREITA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Horário e Configuração */}
        <div className="lg:col-span-5 bg-[#0f0b1f] border border-purple-900/40 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          {/* Quick 1-Click Time Range Presets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>2. Escolha o Horário da Lista (1 Clique):</span>
              </label>
              <span className="text-[11px] font-mono text-pink-300 font-bold">
                {startTime} às {endTime}
              </span>
            </div>

            {/* Instant Dynamic Time Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSetNextHoursPreset(2)}
                className="p-3 rounded-xl bg-gradient-to-br from-pink-950/80 to-purple-950/80 hover:from-pink-900/90 hover:to-purple-900/90 border border-pink-700/60 text-pink-200 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md hover:scale-[1.02]"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Próximas 2 Horas</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetNextHoursPreset(1)}
                className="p-3 rounded-xl bg-gradient-to-br from-purple-950/80 to-indigo-950/80 hover:from-purple-900/90 hover:to-indigo-900/90 border border-purple-700/60 text-purple-200 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md hover:scale-[1.02]"
              >
                <Clock className="w-3.5 h-3.5 text-purple-300" />
                <span>Próxima 1 Hora</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetNextHoursPreset(4)}
                className="p-3 rounded-xl bg-gradient-to-br from-purple-950/80 to-indigo-950/80 hover:from-purple-900/90 hover:to-indigo-900/90 border border-purple-700/60 text-purple-200 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md hover:scale-[1.02]"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-300" />
                <span>Próximas 4 Horas</span>
              </button>

              <button
                type="button"
                onClick={() => setPresetTime('06:00', '12:00', 'Manhã')}
                className="p-2.5 rounded-xl bg-[#17112f] hover:bg-purple-900/50 border border-purple-800/40 text-amber-300 text-xs font-bold transition-all cursor-pointer text-center hover:scale-[1.02]"
              >
                ☀️ Manhã (06h-12h)
              </button>

              <button
                type="button"
                onClick={() => setPresetTime('12:00', '18:00', 'Tarde')}
                className="p-2.5 rounded-xl bg-[#17112f] hover:bg-purple-900/50 border border-purple-800/40 text-amber-300 text-xs font-bold transition-all cursor-pointer text-center hover:scale-[1.02]"
              >
                ☀️ Tarde (12h-18h)
              </button>

              <button
                type="button"
                onClick={() => setPresetTime('18:00', '23:59', 'Noite')}
                className="p-2.5 rounded-xl bg-[#17112f] hover:bg-purple-900/50 border border-purple-800/40 text-purple-300 text-xs font-bold transition-all cursor-pointer text-center hover:scale-[1.02]"
              >
                🌙 Noite (18h-00h)
              </button>
            </div>

            {/* Custom Time inputs */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1 font-bold">Horário Início</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-[#151028] border border-purple-900/40 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-pink-500 font-bold"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1 font-bold">Horário Fim</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-[#151028] border border-purple-900/40 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-pink-500 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Spacing Option */}
          <div className="space-y-2 pt-3 border-t border-purple-900/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>3. Espaçamento Mínimo</span>
              </label>
              <span className="text-xs font-mono font-bold text-pink-400">
                {minSpacingMinutes} min de folga
              </span>
            </div>

            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={minSpacingMinutes}
              onChange={(e) => setMinSpacingMinutes(parseInt(e.target.value, 10))}
              className="w-full accent-pink-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">
              Garante intervalo saudável entre os sinais para respeitar o gerenciamento de banca.
            </p>
          </div>

          {/* Generate CTA Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleGenerate}
              className="w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white shadow-pink-950/70 hover:scale-[1.01]"
            >
              <Flame className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>GERAR LISTA DO {channelInfo.name.toUpperCase()} 🌹</span>
            </button>
          </div>

          {/* Broker link visual indicator */}
          <div className="pt-2 border-t border-purple-900/30 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Link da Lista:</span>
            <a
              href={currentBrokerLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-400 hover:text-pink-300 underline font-bold flex items-center gap-1 truncate max-w-[200px]"
            >
              <span>{currentBrokerLink}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        </div>

        {/* Right Column: Sinais Gerados + BOTÃO DE COPIAR LISTA CORRIGIDA AUTOMÁTICA */}
        <div className="lg:col-span-7 bg-[#0f0b1f] border border-purple-900/40 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between space-y-4">
          {pinkResult && pinkResult.totalSignals > 0 ? (
            <>
              <div>
                {/* Header with Result count & View Mode Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-purple-900/30">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-pink-500 animate-ping" />
                    <h3 className="text-sm font-extrabold text-white">
                      Lista Pronta ({channelInfo.name})
                    </h3>
                    <span className="px-2.5 py-0.5 text-xs font-mono font-black rounded-full bg-pink-950 border border-pink-700/60 text-pink-300">
                      {pinkResult.totalSignals} sinais
                    </span>
                  </div>

                  <div className="flex items-center bg-[#181330] p-1 rounded-xl border border-purple-900/50">
                    <button
                      type="button"
                      onClick={() => setOutputMode('grouped')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        outputMode === 'grouped'
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Horários ☀️/🌙
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutputMode('full')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        outputMode === 'full'
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Post Telegram Oficial 📋
                    </button>
                  </div>
                </div>

                {/* Textarea with generated signals */}
                <div className="mt-3">
                  <textarea
                    readOnly
                    value={
                      outputMode === 'grouped'
                        ? pinkResult.groupedByHourText
                        : pinkResult.formattedTelegramMessage
                    }
                    rows={12}
                    className="w-full bg-[#080512] border border-purple-950 rounded-2xl p-4 font-mono text-xs text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-inner leading-relaxed"
                  />
                </div>
              </div>

              {/* ACTION BUTTONS: COPIAR LISTA CORRIGIDA (O RECURSO PRINCIPAL DO USUÁRIO!) */}
              <div className="space-y-3 pt-2">
                {/* HIGHLIGHTED PRIMARY ACTION: COPIAR LISTA CORRIGIDA AUTOMÁTICA */}
                <button
                  type="button"
                  onClick={handleAuditAndCopyCorrected}
                  disabled={isCorrecting}
                  className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xl shadow-emerald-950/80 cursor-pointer transition-all hover:scale-[1.01] border border-emerald-400/40 disabled:opacity-60"
                  title="Audita automaticamente todos os horários da lista contra o histórico ao vivo e copia a lista corrigida pronta para o Telegram!"
                >
                  {isCorrecting ? (
                    <RefreshCw className="w-5 h-5 text-amber-300 animate-spin" />
                  ) : copiedCorrection ? (
                    <CheckCircle2 className="w-5 h-5 text-amber-300 animate-bounce" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-amber-300" />
                  )}
                  <span>
                    {isCorrecting
                      ? 'AUDITANDO NO AO VIVO...'
                      : copiedCorrection
                      ? 'LISTA CORRIGIDA COPIADA COM SUCESSO! ✅'
                      : 'COPIAR LISTA CORRIGIDA (AUDITORIA AUTOMÁTICA) 🎯'}
                  </span>
                </button>

                {/* Secondary Action Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleCopySignals}
                    className="py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                  >
                    {copiedSignals ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSignals ? 'Copiado!' : 'Copiar Sinais 🌹'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendToCorrection}
                    className="py-3 px-4 rounded-xl bg-[#191432] hover:bg-[#251e4a] border border-purple-700/60 text-purple-200 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Send className="w-4 h-4 text-pink-400" />
                    <span>Abrir na Correção Brava</span>
                  </button>
                </div>
              </div>

              {/* Instant Audit Summary Drawer/Card if corrected */}
              {correctionSummary && (
                <div className="mt-4 p-4 rounded-2xl bg-[#110d29] border border-emerald-500/50 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">
                        Resultado da Lista Corrigida Oficial ({channelInfo.name})
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-black text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/60">
                      {correctionSummary.greenRate.toFixed(1)}% Greens
                    </span>
                  </div>

                  {/* Summary Metric Pills */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center font-mono">
                    <div className="bg-[#181335] p-2 rounded-xl border border-purple-900/40">
                      <span className="text-[9px] text-slate-400 block">Total</span>
                      <span className="text-xs font-black text-white">{correctionSummary.totalSignals}</span>
                    </div>

                    <div className="bg-[#181335] p-2 rounded-xl border border-pink-900/40">
                      <span className="text-[9px] text-pink-400 block">Rosas 🌹</span>
                      <span className="text-xs font-black text-pink-300">{correctionSummary.roses}</span>
                    </div>

                    <div className="bg-[#181335] p-2 rounded-xl border border-amber-900/40">
                      <span className="text-[9px] text-amber-400 block">Altas 🔥</span>
                      <span className="text-xs font-black text-amber-300">{correctionSummary.fires}</span>
                    </div>

                    <div className="bg-[#181335] p-2 rounded-xl border border-purple-900/40">
                      <span className="text-[9px] text-purple-400 block">Roxas 🟣</span>
                      <span className="text-xs font-black text-purple-300">{correctionSummary.purples}</span>
                    </div>

                    <div className="bg-[#181335] p-2 rounded-xl border border-blue-900/40">
                      <span className="text-[9px] text-blue-400 block">Proteção 🛡️</span>
                      <span className="text-xs font-black text-blue-300">{correctionSummary.shields}</span>
                    </div>

                    <div className="bg-[#181335] p-2 rounded-xl border border-rose-900/40">
                      <span className="text-[9px] text-rose-400 block">Reds ❌</span>
                      <span className="text-xs font-black text-rose-300">{correctionSummary.reds}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-3 min-h-[320px]">
              <Flame className="w-12 h-12 text-purple-600/40 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-300">
                Selecione o Aviator e o Horário Desejado
              </h3>
              <p className="text-xs text-purple-300/60 max-w-sm">
                Basta clicar em um dos Aviators (Aviator 1, Aviator VIP ou Aviator Premium) ou escolher o horário para gerar a lista oficial e auditar com 1 clique!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
