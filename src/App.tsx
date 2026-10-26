import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { StrategySidebar } from './components/StrategySidebar';
import { TemperaturaView } from './components/TemperaturaView';
import { Listinha10xView } from './components/Listinha10xView';
import { RadarLiveView } from './components/RadarLiveView';
import { StrategyDetailView } from './components/StrategyDetailView';
import { LiveApiPanel } from './components/LiveApiPanel';
import { SignalsInput } from './components/SignalsInput';
import { SummaryCards } from './components/SummaryCards';
import { TelegramOutput } from './components/TelegramOutput';
import { SignalInspector } from './components/SignalInspector';
import { TemplateCustomizer } from './components/TemplateCustomizer';
import { LauraAiView } from './components/LauraAiView';
import { LauraAiFloatingWidget } from './components/LauraAiFloatingWidget';
import { WhatsAppAutomationView } from './components/WhatsAppAutomationView';

import {
  AviatorCandle,
  AviatorFeedChannel,
  CorrectionSummary,
  RadarApiResponse,
  SignalCorrection,
  TelegramTemplateConfig,
  SidebarTabId,
} from './types';
import {
  fetchRadarBroadcast,
  convertRadarHistoryToCandles,
  mergeCandles,
  RADAR_CHANNELS,
} from './utils/radarApi';
import {
  DEFAULT_TELEGRAM_CONFIG,
  extractSignalTimes,
  processSignalCorrections,
  generateTelegramMessage,
} from './utils/correctionEngine';

import { Sparkles, Plane, Radio } from 'lucide-react';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<SidebarTabId>('temperatura');

  // Active Live API Channel ('aviator_1', 'radar_ao_vivo', 'aviator_premium')
  const [currentChannel, setCurrentChannel] = useState<AviatorFeedChannel>('aviator_1');

  // Real-time Data State (fed directly from the official live broadcast APIs)
  const [candles, setCandles] = useState<AviatorCandle[]>([]);
  const [radarData, setRadarData] = useState<RadarApiResponse | null>(null);
  const [isLiveLoading, setIsLiveLoading] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Signals State
  const [signalsText, setSignalsText] = useState<string>('');
  const [telegramConfig, setTelegramConfig] = useState<TelegramTemplateConfig>(DEFAULT_TELEGRAM_CONFIG);

  // Result state
  const [corrections, setCorrections] = useState<SignalCorrection[] | null>(null);
  const [summary, setSummary] = useState<CorrectionSummary | null>(null);
  const [formattedMessage, setFormattedMessage] = useState<string>('');

  // Modals & Toast state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const pollIntervalRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch real-time broadcast from the selected official API
  const fetchChannelData = useCallback(
    async (ch: AviatorFeedChannel, isSilent = false) => {
      if (!isSilent) setIsLiveLoading(true);

      try {
        const response = await fetchRadarBroadcast(ch, 'BETBRABO');
        setRadarData(response);
        setLastSyncTime(new Date());

        if (response.historico && response.historico.length > 0) {
          const liveCandles = convertRadarHistoryToCandles(response.historico, ch.toUpperCase());
          setCandles((prev) => {
            if (prev.length === 0) return liveCandles;
            return mergeCandles(prev, liveCandles);
          });
        }
      } catch (err: any) {
        console.error('Error fetching live channel:', err);
        if (!isSilent) {
          showToast(`Falha ao conectar à API ${RADAR_CHANNELS[ch]?.name}.`);
        }
      } finally {
        if (!isSilent) setIsLiveLoading(false);
      }
    },
    []
  );

  // Switch channel handler
  const handleSelectChannel = (ch: AviatorFeedChannel) => {
    setCurrentChannel(ch);
    fetchChannelData(ch, false);
    showToast(`Conectado ao ${RADAR_CHANNELS[ch].name} (BETBRABO Ao Vivo)!`);
  };

  // Handle direct candles sync from Radar View or Listinha
  const handleLoadCandlesFromRadar = (newCandles: AviatorCandle[], sourceName: string) => {
    setCandles(newCandles);
    const times = extractSignalTimes(signalsText);
    if (times.length > 0) {
      const result = processSignalCorrections(times, newCandles, telegramConfig.candleWindow);
      const msg = generateTelegramMessage(result.corrections, telegramConfig);
      setCorrections(result.corrections);
      setSummary(result.summary);
      setFormattedMessage(msg);
    }
  };

  // Initialize and keep live API auto-synced continuously
  useEffect(() => {
    // Initial fetch on mount
    fetchChannelData(currentChannel, false);

    // Auto-polling every 4 seconds to maintain official live stream
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => {
      fetchChannelData(currentChannel, true);
    }, 4000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [currentChannel, fetchChannelData]);

  // Keep channel in sync with sidebar clicks if user clicks a specific Aviator room
  const handleSidebarSelectTab = useCallback((tab: SidebarTabId) => {
    setActiveTab(tab);
    if (tab === 'aviator_1' || tab === 'radar_ao_vivo' || tab === 'aviator_premium') {
      setCurrentChannel(tab);
    }
  }, []);

  // Listen to global Laura AI commands (voice or text can switch tabs & load signals)
  useEffect(() => {
    const handleLauraNav = (e: any) => {
      if (e.detail?.tab) {
        handleSidebarSelectTab(e.detail.tab);
        showToast(`Laura AI navegou para: ${e.detail.tab.toUpperCase()}!`);
      }
    };
    const handleLauraSignals = (e: any) => {
      if (e.detail?.text) {
        handleLoadSignalsToMain(e.detail.text);
      }
    };
    window.addEventListener('laura-navigate-tab', handleLauraNav);
    window.addEventListener('laura-load-signals', handleLauraSignals);
    return () => {
      window.removeEventListener('laura-navigate-tab', handleLauraNav);
      window.removeEventListener('laura-load-signals', handleLauraSignals);
    };
  }, [handleSidebarSelectTab]);

  // Handle Generate Action in Correção Brava
  const handleGenerate = () => {
    const times = extractSignalTimes(signalsText);
    if (times.length === 0) {
      showToast('Por favor, informe ao menos um horário de sinal no campo acima.');
      return;
    }

    if (candles.length === 0) {
      showToast('Aguardando sincronização de rodadas da API Oficial...');
      return;
    }

    const channelInfo = RADAR_CHANNELS[currentChannel];
    const customConfig: TelegramTemplateConfig = {
      ...telegramConfig,
      headerTitle: `🚨✈️ RADAR ${channelInfo.name.toUpperCase()} — CORREÇÃO ✈️🚨\n📊 CONFERÊNCIA DOS SINAIS`,
      brokerLink: `🔗 AVIATOR: ${channelInfo.brokerUrl}`,
    };

    const result = processSignalCorrections(times, candles, telegramConfig.candleWindow);
    const msg = generateTelegramMessage(result.corrections, customConfig);
    setCorrections(result.corrections);
    setSummary(result.summary);
    setFormattedMessage(msg);
    showToast(`Correção calculada com as rodadas oficiais do ${channelInfo.name}!`);

    setTimeout(() => {
      const el = document.getElementById('results-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Handle configuration update
  const handleSaveConfig = (newConfig: TelegramTemplateConfig) => {
    setTelegramConfig(newConfig);
    if (corrections && candles.length > 0) {
      const times = extractSignalTimes(signalsText);
      const result = processSignalCorrections(times, candles, newConfig.candleWindow);
      const msg = generateTelegramMessage(result.corrections, newConfig);
      setCorrections(result.corrections);
      setSummary(result.summary);
      setFormattedMessage(msg);
    }
    showToast('Configurações do Telegram atualizadas!');
  };

  // Handle load signals from any strategy into Main Correção
  const handleLoadSignalsToMain = (text: string) => {
    setSignalsText(text);
    setActiveTab('correcao');
    showToast('Sinais carregados na Correção Brava!');

    // Automatically compute audit if candles exist
    if (candles.length > 0) {
      const times = extractSignalTimes(text);
      if (times.length > 0) {
        const channelInfo = RADAR_CHANNELS[currentChannel];
        const customConfig: TelegramTemplateConfig = {
          ...telegramConfig,
          headerTitle: `🚨✈️ RADAR ${channelInfo.name.toUpperCase()} — CORREÇÃO ✈️🚨\n📊 CONFERÊNCIA DOS SINAIS`,
          brokerLink: `🔗 AVIATOR: ${channelInfo.brokerUrl}`,
        };
        const result = processSignalCorrections(times, candles, telegramConfig.candleWindow);
        const msg = generateTelegramMessage(result.corrections, customConfig);
        setCorrections(result.corrections);
        setSummary(result.summary);
        setFormattedMessage(msg);
      }
    }
  };

  const canGenerate = candles.length > 0 && extractSignalTimes(signalsText).length > 0;

  return (
    <div className="min-h-screen bg-[#090712] text-slate-100 flex flex-col selection:bg-purple-600 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-900 to-indigo-900 border border-amber-400/60 rounded-xl shadow-2xl shadow-black text-xs font-semibold text-slate-100 animate-slideUp">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenRadarLive={() => setActiveTab('radar_ao_vivo')}
        onOpenLauraAi={() => setActiveTab('laura_ai')}
        hasCandles={candles.length > 0}
      />

      {/* Two-Column App Layout: Sidebar (Left) + Active View (Right) */}
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto">
        {/* Left Sidebar */}
        <StrategySidebar
          activeTab={activeTab}
          onSelectTab={handleSidebarSelectTab}
          candlesCount={candles.length}
        />

        {/* Right Main Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-x-hidden">
          {/* Tab 0: Laura AI (Conversação por Voz Natural & Chat em Tempo Real) */}
          {activeTab === 'laura_ai' && (
            <LauraAiView
              onNavigateToTab={(tab) => handleSidebarSelectTab(tab)}
              onSelectChannel={(ch) => handleSelectChannel(ch)}
              showToast={showToast}
            />
          )}

          {/* Tab: Central WhatsApp & Automação da Laura AI */}
          {activeTab === 'whatsapp' && (
            <WhatsAppAutomationView
              onNavigateToTab={(tab) => handleSidebarSelectTab(tab)}
              onLoadSignalsToMain={handleLoadSignalsToMain}
              showToast={showToast}
            />
          )}

          {/* Tab 1: Correção Brava (100% Direct Live API) */}
          {activeTab === 'correcao' && (
            <div className="space-y-6">
              {/* Input Phase: 2 Columns (LiveApiPanel + SignalsInput) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <LiveApiPanel
                  currentChannel={currentChannel}
                  onChangeChannel={handleSelectChannel}
                  candles={candles}
                  radarData={radarData}
                  isLoading={isLiveLoading}
                  onRefresh={() => fetchChannelData(currentChannel, false)}
                  lastSyncTime={lastSyncTime}
                />

                <SignalsInput
                  signalsText={signalsText}
                  onChangeText={setSignalsText}
                  onGenerate={handleGenerate}
                  canGenerate={canGenerate}
                  hasCandles={candles.length > 0}
                />
              </div>

              {/* Results Section */}
              {summary && corrections && (
                <section id="results-section" className="space-y-6 pt-2">
                  <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h2 className="text-lg sm:text-xl font-extrabold text-slate-100 flex items-center gap-2">
                        Correção Oficial — {RADAR_CHANNELS[currentChannel].name}
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-950 text-amber-300 border border-purple-800 font-mono">
                          {summary.totalSignals} sinais auditados
                        </span>
                      </h2>
                    </div>
                  </div>

                  <SummaryCards summary={summary} />

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    <div className="xl:col-span-6">
                      <TelegramOutput
                        messageText={formattedMessage}
                        totalSignals={summary.totalSignals}
                      />
                    </div>

                    <div className="xl:col-span-6">
                      <SignalInspector corrections={corrections} />
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Tab: Gráficos de Histórico Ao Vivo (Aviator 1, Radar Ao Vivo, Aviator Premium) */}
          {(activeTab === 'aviator_1' || activeTab === 'radar_ao_vivo' || activeTab === 'aviator_premium') && (
            <RadarLiveView
              candles={candles}
              initialChannel={activeTab}
              onLoadCandlesToMain={handleLoadCandlesFromRadar}
              onNavigateToTab={(tab) => setActiveTab(tab)}
              showToast={showToast}
            />
          )}

          {/* Tab 2: Dashboard de Temperatura do Mercado & IA 24h */}
          {activeTab === 'temperatura' && (
            <TemperaturaView
              candles={candles}
              onNavigateToTab={(tab) => handleSidebarSelectTab(tab)}
              onSelectChannel={(ch) => handleSelectChannel(ch)}
              showToast={showToast}
            />
          )}

          {/* Tab 3: Listinha 10x (100% Direct Official Live APIs) */}
          {activeTab === 'listinha_10x' && (
            <Listinha10xView
              candles={candles}
              fileName={RADAR_CHANNELS[currentChannel].name}
              activeChannel={currentChannel}
              onChangeActiveChannel={handleSelectChannel}
              onOpenRadarLive={() => setActiveTab('radar_ao_vivo')}
              onLoadSignalsToMain={handleLoadSignalsToMain}
              onLoadCandlesToMain={handleLoadCandlesFromRadar}
              showToast={showToast}
            />
          )}

          {/* Tabs 4-7: Specialized Strategies */}
          {(activeTab === 'maxima_10_20' ||
            activeTab === 'maxima_50' ||
            activeTab === 'mil_x' ||
            activeTab === 'duplas_x') && (
            <StrategyDetailView
              strategyId={activeTab}
              candles={candles}
              onLoadSignalsToMain={handleLoadSignalsToMain}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-purple-900/40 bg-[#090712] py-4 px-4 text-center text-xs text-purple-300/50">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-amber-400 rotate-[-20deg]" />
            <span className="font-bold text-slate-300">Analista Bravo</span>
            <span>• Alimentado 100% pelas APIs Oficiais da BETBRABO Ao Vivo ✈️</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Regra Oficial: 6 velas consecutivas • Emojis 🌹 🔥 🟣 🛡 ❌
          </p>
        </div>
      </footer>

      {/* Template Customizer Modal */}
      <TemplateCustomizer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={telegramConfig}
        onSaveConfig={handleSaveConfig}
      />

      {/* Floating Laura AI Voice Trigger (Available on all tabs) */}
      <LauraAiFloatingWidget
        activeTab={activeTab}
        onOpenFullLaura={() => setActiveTab('laura_ai')}
      />
    </div>
  );
}
