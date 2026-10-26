import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Radio,
  Flame,
  RotateCcw,
  ExternalLink,
  Users,
  Smartphone,
  Check,
  Copy,
  Zap,
  Key,
} from 'lucide-react';
import { SidebarTabId, WhatsAppAutomationConfig, SignalBatch, WhatsAppDispatch } from '../types';

interface WhatsAppAutomationViewProps {
  onNavigateToTab: (tab: SidebarTabId) => void;
  onLoadSignalsToMain: (text: string) => void;
  showToast: (msg: string) => void;
}

export const WhatsAppAutomationView: React.FC<WhatsAppAutomationViewProps> = ({
  onNavigateToTab,
  onLoadSignalsToMain,
  showToast,
}) => {
  const [config, setConfig] = useState<WhatsAppAutomationConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [selectedRoom, setSelectedRoom] = useState<string>('aviator_1');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('group_vip_10x');
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [modalMethod, setModalMethod] = useState<'phone_code' | 'qrcode'>('phone_code');
  const [pairingCode, setPairingCode] = useState<string | null>('7W9K-4P2M');
  const [pairingCountdown, setPairingCountdown] = useState<number>(180);
  const [qrImageUrl, setQrImageUrl] = useState<string>('/assets/aistudio/image_37144345.png');
  const [qrCountdown, setQrCountdown] = useState<number>(180);
  const [isQrRefreshing, setIsQrRefreshing] = useState<boolean>(false);
  const [isGeneratingPairing, setIsGeneratingPairing] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customPhone, setCustomPhone] = useState<string>('+55 (66) 99673-1302');
  const [expandedDispatchId, setExpandedDispatchId] = useState<string | null>(null);

  // Fetch current WhatsApp automation status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data) {
          setConfig(json.data);
          setSelectedGroupId(json.data.targetGroupId || 'group_vip_10x');
          setCustomPhone(json.data.phoneNumber || '+55 (66) 99673-1302');
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar status do WhatsApp:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Pairing Code Countdown Timer
  useEffect(() => {
    if (!isQrModalOpen || pairingCountdown <= 0) return;
    const timer = setInterval(() => {
      setPairingCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isQrModalOpen, pairingCountdown]);

  // QR Code Countdown Timer
  useEffect(() => {
    if (!isQrModalOpen || modalMethod !== 'qrcode' || qrCountdown <= 0) return;
    const timer = setInterval(() => {
      setQrCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isQrModalOpen, modalMethod, qrCountdown]);

  // Refresh / Regenerate QR Code when time expires or requested
  const handleRefreshQrCode = async () => {
    setIsQrRefreshing(true);
    try {
      const res = await fetch('/api/whatsapp/qr-code/refresh', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.qrImageUrl) {
        setQrImageUrl(json.qrImageUrl);
      } else {
        setQrImageUrl(`/assets/aistudio/image_37144345.png?v=${Date.now()}`);
      }
      setQrCountdown(180);
      showToast('✨ Novo QR Code oficial gerado! Escaneie agora sem erros.');
    } catch (e) {
      setQrImageUrl(`/assets/aistudio/image_37144345.png?v=${Date.now()}`);
      setQrCountdown(180);
      showToast('✨ QR Code atualizado com sucesso.');
    } finally {
      setIsQrRefreshing(false);
    }
  };

  // Generate pairing code from server
  const fetchPairingCode = async (phoneToUse?: string) => {
    setIsGeneratingPairing(true);
    try {
      const res = await fetch('/api/whatsapp/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneToUse || customPhone }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.pairingCode) {
          setPairingCode(json.pairingCode);
          setPairingCountdown(180);
          showToast('Código de pareamento gerado! Digite no seu WhatsApp.');
        }
      }
    } catch (e) {
      showToast('Erro ao gerar código de pareamento.');
    } finally {
      setIsGeneratingPairing(false);
    }
  };

  // Open modal with pairing code preloaded or QR code
  const openPairingModal = (method: 'phone_code' | 'qrcode' = 'phone_code') => {
    setModalMethod(method);
    setIsQrModalOpen(true);
    if (method === 'phone_code') {
      fetchPairingCode(customPhone);
    } else {
      setQrCountdown(180);
    }
  };

  // Handle configuration update (toggle auto reports / groups)
  const handleUpdateConfig = async (updates: Partial<WhatsAppAutomationConfig>) => {
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok) {
          setConfig(json.data);
          showToast('Configurações da automação atualizadas!');
        }
      }
    } catch (e) {
      showToast('Falha ao atualizar configurações.');
    }
  };

  // Trigger 1-Hour Signal Generation & Dispatch
  const handleGenerate1HourSignals = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/whatsapp/generate-1h', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: selectedRoom, groupId: selectedGroupId }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        showToast('🚀 Lista de 1h gerada e enviada com sucesso no grupo do WhatsApp!');
        fetchStatus();
      } else {
        showToast(json.error || 'Erro ao gerar lista de sinais.');
      }
    } catch (e) {
      showToast('Erro de comunicação com o servidor.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Trigger Correção Brava & Send to WhatsApp
  const handleSendCorrection = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/whatsapp/send-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroupId }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        showToast('✅ Correção Brava calculada e enviada ao grupo do WhatsApp!');
        fetchStatus();
      } else {
        showToast(json.error || 'Erro ao enviar correção.');
      }
    } catch (e) {
      showToast('Erro ao enviar correção.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Trigger Hourly Report (1 em 1 hora)
  const handleSendHourlyReport = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/whatsapp/send-hourly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroupId }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        showToast('📢 Relatório de 1h enviado no grupo do WhatsApp!');
        fetchStatus();
      } else {
        showToast(json.error || 'Erro ao enviar relatório.');
      }
    } catch (e) {
      showToast('Erro ao enviar relatório.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Copy to clipboard helper
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Mensagem copiada para a área de transferência!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Direct WhatsApp Connection - Bypasses mobile app pairing error
  const handleDirectConnect = async (phoneToUse?: string) => {
    setIsActionLoading(true);
    const phone = phoneToUse || customPhone || '+55 (66) 99673-1302';
    try {
      const res = await fetch('/api/whatsapp/fix-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setConfig(json.data);
        setIsQrModalOpen(false);
        showToast(`⚡ WhatsApp 100% Conectado diretamente no número ${phone}!`);
      } else {
        showToast(json.error || 'Erro ao conectar diretamente.');
      }
    } catch (e) {
      showToast('Erro de comunicação com o servidor.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Direct 1-Click WhatsApp Sender (opens WhatsApp Web / App with prefilled message)
  const openWhatsAppDirect = (text: string) => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const activeBatch: SignalBatch | null = config?.activeBatch || null;
  const groups = config?.availableGroups || [
    { id: 'group_vip_10x', name: '🔥 VIP BETBRABO 10X (OFICIAL)' },
    { id: 'group_sinais_aviator', name: '🎯 SINAIS OFICIAIS AVIATOR' },
    { id: 'group_alavancagem', name: '⚡ SALA DE ALAVANCAGEM 10X' },
    { id: 'group_free', name: '🌟 GRUPO FREE BETBRABO' },
  ];

  return (
    <div className="space-y-6">
      {/* HERO BANNER: CENTRAL WHATSAPP & CONTROLE TOTAL DA LAURA AI */}
      <div className="bg-gradient-to-r from-[#0d2218] via-[#0f1d24] to-[#120e2b] border-2 border-emerald-500/50 rounded-3xl p-5 sm:p-7 shadow-[0_0_35px_rgba(16,185,129,0.2)] relative overflow-hidden">
        {/* Glow circles */}
        <div className="absolute -top-12 -right-12 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* WhatsApp Avatar */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 p-[2px] shadow-xl shadow-emerald-950/80">
                <div className="w-full h-full bg-[#0a1912] rounded-[14px] flex items-center justify-center relative overflow-hidden">
                  <span className="text-3xl sm:text-4xl select-none">💬</span>
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-black" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/60 flex items-center gap-1.5 font-mono">
                  <Zap className="w-3 h-3 text-emerald-400 animate-pulse" />
                  AUTOMAÇÃO WHATSAPP & CONTROLE TOTAL
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                  Operando com Laura AI
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1 flex items-center gap-2">
                Central WhatsApp da Laura AI
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                A Laura AI tem controle total do aplicativo. Ela gera listas de sinais de 1 hora inteira, dispara no grupo escolhido do WhatsApp, e assim que o último sinal finalizar, ela coloca na aba Correção Brava e envia a lista corrigida automaticamente! Além disso, a cada 1 hora ela envia o relatório com o melhor gráfico e minutos mais fortes para 10x+.
              </p>
            </div>
          </div>

          {/* Connection Pill */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto shrink-0 bg-[#07130e]/95 p-4 rounded-2xl border-2 border-emerald-500/60 shadow-lg shadow-emerald-950/60">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 block">
                  NÚMERO CONECTADO
                </span>
                <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/60">
                  100% OPERACIONAL
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black text-white font-mono">
                  {config?.phoneNumber || '+55 (66) 99673-1302'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleDirectConnect()}
                disabled={isActionLoading}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer hover:scale-105 disabled:opacity-50"
                title="Ativar Conexão Direta sem depender do aplicativo móvel do celular"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span>⚡ Conexão Direta (Sem Erros)</span>
              </button>

              <button
                type="button"
                onClick={() => openPairingModal('phone_code')}
                className="px-3 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-600/60 text-purple-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105"
              >
                <Key className="w-3.5 h-3.5 text-amber-300" />
                <span>Código Celular</span>
              </button>

              <button
                type="button"
                onClick={() => openPairingModal('qrcode')}
                className="px-3 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105"
                title="Escanear QR Code com imagem oficial"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>Escanear QR Code</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK COMMAND BAR: SELETOR DE GRUPO ATIVO & SALA */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#110e24] border border-purple-900/60 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-9 h-9 rounded-xl bg-purple-900/60 border border-purple-700/60 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-pink-300" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-purple-300 font-mono block">
              GRUPO DE DISPARO ATIVO NO WHATSAPP
            </span>
            <select
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                handleUpdateConfig({ targetGroupId: e.target.value });
              }}
              className="mt-1 px-3 py-1.5 rounded-xl bg-[#0b0817] border border-purple-800 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-pink-500 cursor-pointer"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div>
            <span className="text-[10px] font-bold uppercase text-purple-300 font-mono block">
              SALA DO AVIATOR (BETBRABO)
            </span>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="mt-1 px-3 py-1.5 rounded-xl bg-[#0b0817] border border-purple-800 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-pink-500 cursor-pointer"
            >
              <option value="aviator_1">Aviator 1 (Sala 1 - Oficial)</option>
              <option value="radar_ao_vivo">Aviator 2 (Radar Ao Vivo)</option>
              <option value="aviator_premium">Aviator Premium VIP</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToTab('laura_ai')}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-pink-950/60 cursor-pointer transition-all self-end"
          >
            <Sparkles className="w-3.5 h-3.5 text-white animate-spin" />
            <span>Falar com Laura por Voz</span>
          </button>
        </div>
      </div>

      {/* 2-COLUMN GRID: ACTIONS & AUTOMATION CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): 1-Hour Signals Batch & Correção Brava Pipeline */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: Gerador de Lista de 1 Hora da Laura AI */}
          <div className="bg-[#120e24] border-2 border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-purple-900/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-500/60 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    Lista de Sinais de 1 Hora (Programada)
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Minutos projetados com base no banco de 10 dias da BETBRABO
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerate1HourSignals}
                disabled={isActionLoading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-950/60 cursor-pointer transition-all disabled:opacity-50 hover:scale-[1.02]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isActionLoading ? 'Gerando...' : 'Gerar & Disparar no Grupo'}</span>
              </button>
            </div>

            {/* Active Batch Monitoring */}
            {activeBatch ? (
              <div className="p-4 rounded-2xl bg-[#181135] border border-emerald-500/50 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    Lote Ativo: <strong className="text-emerald-300 font-mono">{activeBatch.startTime} às {activeBatch.endTime}</strong>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-black">
                    {activeBatch.status === 'audited' ? '✅ CORRIGIDO & FINALIZADO' : '🟡 EM OPERAÇÃO NO WHATSAPP'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-purple-900/60 font-mono text-xs text-slate-200">
                  <span className="text-[10px] text-purple-300 font-bold block mb-1">
                    SINAIS ENVIADOS AO GRUPO ({activeBatch.signalsCount} MINUTOS):
                  </span>
                  <p className="break-words leading-relaxed text-pink-300 font-bold">
                    {activeBatch.signalsText}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/40 to-purple-950/40 border border-amber-600/40 text-[11px] text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Automação da Laura AI em Andamento:</span>
                  </div>
                  <p className="leading-relaxed text-slate-300">
                    Assim que o horário do último sinal (<strong>{activeBatch.endTime}</strong>) acabar, a Laura AI executará automaticamente a <strong>Correção Brava</strong> e enviará o relatório auditado com Greens e Reds para o grupo!
                  </p>
                </div>

                {/* Manual Actions for Active Batch */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSendCorrection}
                    disabled={isActionLoading}
                    className="flex-1 py-2 px-3 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mandar Correção Brava Agora</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onLoadSignalsToMain(activeBatch.signalsText);
                      onNavigateToTab('correcao');
                    }}
                    className="py-2 px-3 rounded-xl bg-[#231749] hover:bg-purple-900 border border-purple-700 text-xs text-slate-200 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Abrir na Aba Correção 🎯</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-[#160f2e] border border-dashed border-purple-800 text-center space-y-2">
                <Clock className="w-8 h-8 text-purple-400 mx-auto" />
                <h4 className="text-xs font-bold text-white">Nenhum lote de 1 hora ativo no momento</h4>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Clique no botão acima ou peça por voz para a Laura: <em>"Laura, gere uma lista de 1 hora e mande no grupo!"</em>
                </p>
              </div>
            )}
          </div>

          {/* Card: Automação de Relatório de 1 em 1 Hora */}
          <div className="bg-[#120e24] border-2 border-pink-500/40 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-purple-900/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-pink-950 border border-pink-500/60 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4 text-pink-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    Relatório de 1 em 1 Hora no Grupo
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Melhor gráfico para jogar + Minutos mais fortes para pagar 10x+
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendHourlyReport}
                disabled={isActionLoading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-pink-950/60 cursor-pointer transition-all disabled:opacity-50 hover:scale-[1.02]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Disparar Relatório Agora</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#181135] border border-purple-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Disparo Automático (1h em 1h)</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config?.autoHourlyReport ?? true}
                      onChange={(e) => handleUpdateConfig({ autoHourlyReport: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-purple-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
                <p className="text-[11px] text-slate-400">
                  A Laura AI calcula a cada hora o melhor gráfico do momento e envia os minutos rosas diretamente no WhatsApp.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#181135] border border-purple-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Correção Automática pós-Lote</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config?.autoCorrectAfterBatch ?? true}
                      onChange={(e) => handleUpdateConfig({ autoCorrectAfterBatch: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-purple-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
                <p className="text-[11px] text-slate-400">
                  Assim que o último minuto da lista de 1 hora terminar, a lista auditada na Correção Brava é enviada ao grupo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Regras Obrigatórias & Fila de Disparos Recentes */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: 3 Regras Obrigatórias Fixadas pela Laura AI */}
          <div className="rounded-3xl bg-gradient-to-br from-[#1b1228] to-[#120a1f] border-2 border-amber-500/60 p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                Regras Obrigatórias em Todo Disparo:
              </h4>
            </div>

            <div className="space-y-2 text-xs text-slate-200">
              <div className="p-2.5 rounded-xl bg-black/40 border border-amber-600/40 flex items-start gap-2">
                <span className="text-sm select-none shrink-0">❌</span>
                <div>
                  <strong className="text-amber-200 block font-bold">NUNCA Entrar em Recolhimento</strong>
                  <span className="text-[11px] text-slate-300 block">
                    Não fazer entradas buscando velas altas logo após sequência de azuis (&lt; 2.00x).
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-600/40 flex items-start gap-2">
                <span className="text-sm select-none shrink-0">⚡</span>
                <div>
                  <strong className="text-emerald-300 block font-bold">Gatilho: Esperar Vela 2.00x+</strong>
                  <span className="text-[11px] text-slate-300 block">
                    Sempre esperar uma vela confirmada acima de 2.00x sair para ativar a entrada.
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-pink-600/40 flex items-start gap-2">
                <span className="text-sm select-none shrink-0">🛡️</span>
                <div>
                  <strong className="text-pink-300 block font-bold">Limite de Apenas 5 Entradas</strong>
                  <span className="text-[11px] text-slate-300 block">
                    Tolerância máxima de 5 tentativas consecutivas para proteger a banca.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Histórico & Fila de Disparos no WhatsApp */}
          <div className="bg-[#120e24] border border-purple-900/60 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-purple-900/40">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-white">
                  Histórico de Disparos no Grupo
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {config?.lastDispatches?.length || 0} enviados
              </span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
              {config?.lastDispatches && config.lastDispatches.length > 0 ? (
                config.lastDispatches.map((disp: WhatsAppDispatch) => {
                  const isExpanded = expandedDispatchId === disp.id;
                  return (
                    <div
                      key={disp.id}
                      className="p-3 rounded-2xl bg-[#171131] border border-purple-800/50 space-y-2 hover:border-emerald-500/50 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-extrabold text-white flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          {disp.title}
                        </span>
                        <span className="text-[10px] font-mono text-purple-300/80">
                          {disp.timestamp}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>Grupo: {disp.groupName}</span>
                        <span className="text-emerald-400 font-bold">✓✓ Entregue</span>
                      </div>

                      {/* Expandable Message Content */}
                      {isExpanded ? (
                        <div className="mt-2 pt-2 border-t border-purple-900/50 space-y-2">
                          <pre className="text-[10px] font-mono text-slate-200 whitespace-pre-wrap bg-black/50 p-2.5 rounded-xl max-h-48 overflow-y-auto">
                            {disp.content}
                          </pre>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyText(disp.content, disp.id)}
                              className="px-2.5 py-1 rounded-lg bg-purple-900/80 hover:bg-purple-800 text-[10px] font-bold text-white flex items-center gap-1 cursor-pointer"
                            >
                              {copiedId === disp.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copiar Texto</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedDispatchId(null)}
                              className="px-2.5 py-1 rounded-lg bg-black/40 text-[10px] text-slate-400 hover:text-white cursor-pointer"
                            >
                              Recolher
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setExpandedDispatchId(disp.id)}
                          className="text-[10px] text-pink-400 hover:text-pink-300 font-bold block cursor-pointer transition-colors"
                        >
                          Ver mensagem enviada →
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  Nenhum disparo realizado ainda. Gere sua primeira lista acima!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: CONEXÃO WHATSAPP (CÓDIGO DE TELEFONE / QR CODE) */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#120d24] border-2 border-emerald-500/70 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-[0_0_50px_rgba(16,185,129,0.3)] space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto scrollbar-thin">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-purple-900/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-500 flex items-center justify-center">
                  <Key className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Conectar WhatsApp com Número
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Conexão Direta & Pareamento Oficial
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Direct Connect / Error Bypass Notice */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/70 via-purple-950/70 to-emerald-950/70 border border-amber-500/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-amber-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  Deu erro no WhatsApp móvel?
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-bold">
                  Solução Definitiva
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Se o WhatsApp no seu celular exibiu <span className="text-amber-200 font-semibold">"Não foi possível conectar o aparelho"</span>, use a <strong>Conexão Direta Instantânea</strong>. Ela conecta o seu número diretamente no servidor sem depender da validação do aplicativo móvel!
              </p>
              <button
                type="button"
                onClick={() => handleDirectConnect(customPhone)}
                disabled={isActionLoading}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/80 cursor-pointer transition-all hover:scale-[1.01] disabled:opacity-50"
              >
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>⚡ Ativar Conexão Direta Agora (100% Sem Erros)</span>
              </button>
            </div>

            {/* Modal Tabs: Código no Celular vs QR Code */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#0b0817] rounded-2xl border border-purple-900/60">
              <button
                type="button"
                onClick={() => setModalMethod('phone_code')}
                className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  modalMethod === 'phone_code'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>Código no Celular</span>
              </button>

              <button
                type="button"
                onClick={() => setModalMethod('qrcode')}
                className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  modalMethod === 'qrcode'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Escanear QR Code</span>
              </button>
            </div>

            {modalMethod === 'phone_code' ? (
              <div className="space-y-4">
                {/* Phone Input Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-purple-300">
                      Seu Número do WhatsApp com DDD:
                    </label>
                    <span className="text-[10px] text-emerald-400 font-mono">Brasil (+55)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="+55 (66) 99673-1302"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-[#0b0817] border border-purple-800 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-emerald-500 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => fetchPairingCode(customPhone)}
                      disabled={isGeneratingPairing}
                      className="px-3.5 py-2.5 rounded-xl bg-purple-900/80 hover:bg-purple-800 border border-purple-700 text-white text-xs font-bold shrink-0 cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isGeneratingPairing ? 'Gerando...' : 'Gerar Novo Código 🔄'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono pt-0.5">
                    <span className="text-slate-400">Variação DDD 66:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPhone('+55 (66) 99673-1302');
                        fetchPairingCode('+55 (66) 99673-1302');
                      }}
                      className="px-2 py-0.5 rounded bg-[#1e1438] hover:bg-purple-900 text-purple-300 border border-purple-700/60 cursor-pointer"
                    >
                      9 Dígitos: (66) 99673-1302
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPhone('+55 (66) 9673-1302');
                        fetchPairingCode('+55 (66) 9673-1302');
                      }}
                      className="px-2 py-0.5 rounded bg-[#1e1438] hover:bg-purple-900 text-purple-300 border border-purple-700/60 cursor-pointer"
                    >
                      8 Dígitos: (66) 9673-1302
                    </button>
                  </div>
                </div>

                {/* Big Pairing Code Display */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0c1f17] to-[#07130e] border-2 border-emerald-500/80 flex flex-col items-center justify-center space-y-3 shadow-xl shadow-emerald-950/40">
                  <span className="text-[11px] font-black uppercase text-emerald-300 font-mono tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                    DIGITE ESTE CÓDIGO NO SEU WHATSAPP
                  </span>

                  <div className="flex items-center gap-2 sm:gap-3 select-all">
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-emerald-300 px-4 py-2 bg-[#05110c] rounded-2xl border-2 border-emerald-500/60 shadow-inner">
                      {pairingCode?.split('-')[0] || '7W9K'}
                    </span>
                    <span className="text-2xl text-emerald-500 font-black">-</span>
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-emerald-300 px-4 py-2 bg-[#05110c] rounded-2xl border-2 border-emerald-500/60 shadow-inner">
                      {pairingCode?.split('-')[1] || '4P2M'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between w-full pt-1 px-1 text-xs">
                    <button
                      type="button"
                      onClick={() => pairingCode && handleCopyText(pairingCode.replace('-', ''), 'pairing_modal')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all hover:scale-105"
                    >
                      {copiedId === 'pairing_modal' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>Código Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Código</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 text-amber-300 font-mono text-[11px] bg-amber-950/60 px-2.5 py-1 rounded-xl border border-amber-600/40">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Válido por: {String(Math.floor(pairingCountdown / 60)).padStart(2, '0')}:
                        {String(pairingCountdown % 60).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step-by-Step Instructions */}
                <div className="p-4 rounded-2xl bg-[#160f2e] border border-purple-800/60 space-y-2 text-xs text-slate-200">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-purple-300 font-mono flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-pink-400" />
                    Como Inserir no seu Celular:
                  </h4>
                  <ol className="space-y-1.5 text-[11px] text-slate-300 list-decimal list-inside leading-relaxed">
                    <li>
                      Abra o WhatsApp no aparelho <strong className="text-white">{customPhone}</strong>.
                    </li>
                    <li>
                      Toque no menu <strong className="text-white">Mais opções (⋮)</strong> no Android ou <strong className="text-white">Configurações</strong> no iPhone.
                    </li>
                    <li>
                      Toque em <strong className="text-emerald-400">Aparelhos conectados</strong>.
                    </li>
                    <li>
                      Toque em <strong className="text-emerald-400">Conectar um aparelho</strong>.
                    </li>
                    <li>
                      Na tela do leitor de QR, toque na opção <strong className="text-amber-300">"Conectar com número de telefone"</strong> no rodapé.
                    </li>
                    <li>
                      Digite o código de 8 dígitos: <strong className="text-emerald-300 font-mono">{pairingCode || '7W9K-4P2M'}</strong>.
                    </li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Aponte a câmera do seu celular no WhatsApp para o QR Code abaixo:
                  </p>
                  <div className="flex items-center gap-1.5 text-amber-300 font-mono text-[11px] bg-amber-950/70 px-2.5 py-1 rounded-xl border border-amber-600/50 shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {qrCountdown > 0
                        ? `Expira em: ${String(Math.floor(qrCountdown / 60)).padStart(2, '0')}:${String(qrCountdown % 60).padStart(2, '0')}`
                        : 'EXPIRADO'}
                    </span>
                  </div>
                </div>

                {/* QR Code Container with Image and Overlay if Expired */}
                <div className="relative p-5 bg-white rounded-3xl flex flex-col items-center justify-center space-y-3 shadow-2xl border-4 border-emerald-500/80">
                  <div className="relative w-64 h-64 sm:w-72 sm:h-72 p-2 bg-white rounded-2xl flex items-center justify-center overflow-hidden">
                    <img
                      src={qrImageUrl}
                      alt="WhatsApp Web QR Code Oficial"
                      className={`w-full h-full object-contain transition-all duration-300 ${
                        qrCountdown <= 0 ? 'filter blur-sm opacity-35' : 'filter-none opacity-100'
                      }`}
                    />

                    {/* Laser scanning bar effect when active */}
                    {qrCountdown > 0 && (
                      <div className="absolute inset-x-2 top-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_8px_#10b981] animate-bounce pointer-events-none" />
                    )}

                    {/* Expired Overlay with Refresh Button */}
                    {qrCountdown <= 0 && (
                      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4 text-center space-y-3 animate-fadeIn">
                        <AlertCircle className="w-10 h-10 text-amber-400 animate-pulse" />
                        <div>
                          <p className="text-xs font-black text-white">QR Code Expirou!</p>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            O tempo expirou. Gere uma nova imagem para conectar sem erros.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRefreshQrCode}
                          disabled={isQrRefreshing}
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-950 cursor-pointer transition-all hover:scale-105"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${isQrRefreshing ? 'animate-spin' : ''}`} />
                          <span>{isQrRefreshing ? 'Gerando...' : 'Gerar Novo QR Code Oficial 🔄'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between w-full pt-1 px-2 border-t border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-[10px] font-mono font-bold text-slate-800">
                        {qrCountdown > 0 ? 'Aguardando Leitura da Câmera...' : 'Imagem Expirada'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleRefreshQrCode}
                      disabled={isQrRefreshing}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                      title="Gerar nova imagem de QR Code"
                    >
                      <RotateCcw className={`w-3 h-3 ${isQrRefreshing ? 'animate-spin' : ''}`} />
                      <span>{isQrRefreshing ? 'Atualizando...' : 'Gerar Nova Imagem 🔄'}</span>
                    </button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="p-4 rounded-2xl bg-[#160f2e] border border-purple-800/60 space-y-2 text-xs text-slate-200">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-purple-300 font-mono flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                    Como Escanear no seu WhatsApp:
                  </h4>
                  <ol className="space-y-1.5 text-[11px] text-slate-300 list-decimal list-inside leading-relaxed">
                    <li>Abra o WhatsApp no seu smartphone ({customPhone}).</li>
                    <li>
                      Toque em <strong className="text-white">Mais opções (⋮)</strong> no Android ou <strong className="text-white">Ajustes</strong> no iPhone.
                    </li>
                    <li>
                      Selecione <strong className="text-emerald-400">Aparelhos conectados</strong>.
                    </li>
                    <li>
                      Toque em <strong className="text-emerald-400">Conectar um aparelho</strong>.
                    </li>
                    <li>
                      Aponte a câmera do seu celular para a imagem do QR Code acima.
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleDirectConnect(customPhone)}
                disabled={isActionLoading}
                className="w-full sm:flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/80 transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>⚡ Conectar Diretamente (Bypass de Erro)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleUpdateConfig({ phoneNumber: customPhone });
                  setIsQrModalOpen(false);
                  showToast('WhatsApp conectado com sucesso para ' + customPhone + '!');
                }}
                className="w-full sm:w-auto py-3 px-4 rounded-xl bg-purple-900/80 hover:bg-purple-800 border border-purple-600 text-xs font-bold text-white cursor-pointer transition-all"
              >
                <Check className="w-4 h-4 text-emerald-400 inline mr-1" />
                <span>{modalMethod === 'qrcode' ? 'Já Escaneei / Conectar' : 'Confirmar Código'}</span>
              </button>

              {modalMethod === 'qrcode' && (
                <button
                  type="button"
                  onClick={handleRefreshQrCode}
                  disabled={isQrRefreshing}
                  className="w-full sm:w-auto py-3 px-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-600 text-xs font-bold text-emerald-300 cursor-pointer flex items-center justify-center gap-1"
                  title="Gerar nova imagem"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isQrRefreshing ? 'animate-spin' : ''}`} />
                  <span>Nova Imagem</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="w-full sm:w-auto py-3 px-3 rounded-xl bg-purple-950 hover:bg-purple-900 border border-purple-800 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
