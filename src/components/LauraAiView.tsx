import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Play,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Send,
  Radio,
  Flame,
  Shield,
  Layers,
  Clock,
  ExternalLink,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  CheckCircle2,
  Wand2,
} from 'lucide-react';
import {
  LauraChatMessage,
  LauraVoiceState,
  LauraConnectionState,
  SidebarTabId,
  AviatorFeedChannel,
} from '../types';

interface LauraAiViewProps {
  onNavigateToTab?: (tab: SidebarTabId) => void;
  onSelectChannel?: (ch: AviatorFeedChannel) => void;
  showToast?: (msg: string) => void;
}

export const LauraAiView: React.FC<LauraAiViewProps> = ({
  onNavigateToTab,
  onSelectChannel,
  showToast,
}) => {
  // Voice & Connection States
  const [connectionState, setConnectionState] = useState<LauraConnectionState>('disconnected');
  const [voiceState, setVoiceState] = useState<LauraVoiceState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [lastToolAction, setLastToolAction] = useState<string | null>(null);

  // 10-Day Historical Data Intelligence
  const [historicalData, setHistoricalData] = useState<any | null>(null);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(false);

  // Fetch 10-Day Historical Intelligence
  const fetchHistoricalData = useCallback(async () => {
    try {
      setIsLoadingHistorical(true);
      const res = await fetch('/api/historical/10days');
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data) {
          setHistoricalData(json.data);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar dados históricos de 10 dias:', e);
    } finally {
      setIsLoadingHistorical(false);
    }
  }, []);

  useEffect(() => {
    fetchHistoricalData();
    const interval = setInterval(fetchHistoricalData, 60000); // atualiza a cada minuto
    return () => clearInterval(interval);
  }, [fetchHistoricalData]);

  // Chat & History
  const [messages, setMessages] = useState<LauraChatMessage[]>([
    {
      id: 'welcome_1',
      role: 'assistant',
      text: 'Olá! Eu sou a Laura AI, sua assistente pessoal inteligente. Estou conectada em tempo real com os 3 gráficos do Aviator na BETBRABO. Como posso ajudar você agora? Você pode falar pelo microfone ou digitar sua dúvida.',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isSendingText, setIsSendingText] = useState<boolean>(false);

  // Audio Context & Stream Refs
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  isMutedRef.current = isMuted;

  // Scroll to bottom of transcript
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, lastToolAction, voiceState]);

  // Clean up Audio and WS on unmount
  useEffect(() => {
    return () => {
      disconnectVoiceSession();
    };
  }, []);

  // Stop all active audio playback (Interruption)
  const stopAudioPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch (e) {}
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    setVoiceState('listening');
  }, []);

  // Downsample Float32Array to 16kHz Int16 PCM
  const downsampleTo16k = (
    buffer: Float32Array,
    inputRate: number,
    outputRate = 16000
  ): Int16Array => {
    if (inputRate === outputRate) {
      const output = new Int16Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        const s = Math.max(-1, Math.min(1, buffer[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return output;
    }
    const sampleRateRatio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      const val = count > 0 ? accum / count : 0;
      const s = Math.max(-1, Math.min(1, val));
      result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7fff;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  };

  // Convert Int16Array to Base64
  const pcm16ToBase64 = (int16: Int16Array): string => {
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Play incoming 24kHz raw PCM Audio chunk gaplessly
  const playAudioChunk = useCallback((base64Data: string) => {
    if (!outputAudioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      outputAudioCtxRef.current = new AudioCtx({ sampleRate: 24000 });
    }

    const ctx = outputAudioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    try {
      const binary = atob(base64Data);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextStartTimeRef.current);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      activeSourcesRef.current.push(source);
      setVoiceState('speaking');

      source.onended = () => {
        const idx = activeSourcesRef.current.indexOf(source);
        if (idx !== -1) activeSourcesRef.current.splice(idx, 1);
        if (
          activeSourcesRef.current.length === 0 &&
          ctx.currentTime >= nextStartTimeRef.current - 0.08
        ) {
          setVoiceState('listening');
        }
      };
    } catch (err) {
      console.error('Erro ao decodificar áudio recebido:', err);
    }
  }, []);

  // Connect to Gemini Live Voice WebSocket
  const startVoiceSession = async () => {
    setErrorMessage(null);
    setMicPermissionError(null);
    setConnectionState('connecting');

    // 1. Immediately request microphone in direct response to user gesture
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Seu navegador não possui suporte a captura de áudio via microfone.');
      }

      try {
        // Preferred high quality voice settings
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (constraintErr) {
        // Fallback to basic audio constraint without advanced processing
        console.warn('Fallback para getUserMedia básico:', constraintErr);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (micErr: any) {
      console.warn('Erro ao solicitar permissão de microfone:', micErr);
      setConnectionState('disconnected');
      setVoiceState('idle');

      let explanation = 'Permissão de microfone bloqueada pelo navegador.';
      if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
        explanation = 'Permissão de microfone negada. Clique no ícone de cadeado (🔒) ao lado do endereço do site no seu navegador, mude "Microfone" para "Permitir" e clique em "Tentar Novamente".';
      } else if (micErr.name === 'NotFoundError' || micErr.name === 'DevicesNotFoundError') {
        explanation = 'Nenhum microfone foi detectado no seu dispositivo. Conecte um microfone ou fone de ouvido para falar com a Laura AI.';
      } else if (micErr.name === 'NotReadableError' || micErr.name === 'TrackStartError') {
        explanation = 'O microfone está em uso por outro aplicativo ou bloqueado pelo sistema operacional. Feche outros programas que usam o microfone e tente novamente.';
      }

      setMicPermissionError(explanation);
      return;
    }

    mediaStreamRef.current = stream;

    // 2. Open WebSocket to backend Live API
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('[Laura AI Client] WebSocket de voz conectado!');
        setConnectionState('connected');
        setVoiceState('listening');

        // Setup AudioContext & ScriptProcessor
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const inputCtx = new AudioCtx();
          inputAudioCtxRef.current = inputCtx;

          const source = inputCtx.createMediaStreamSource(stream!);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processorNodeRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);

            // Compute RMS volume for visualizer
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
              sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);
            setAudioLevel(Math.min(100, Math.round(rms * 400)));

            // Downsample to 16kHz
            const pcm16 = downsampleTo16k(inputData, inputCtx.sampleRate, 16000);
            const base64 = pcm16ToBase64(pcm16);

            ws.send(JSON.stringify({ type: 'audio', data: base64 }));
          };

          source.connect(processor);
          processor.connect(inputCtx.destination);

          if (showToast) showToast('Laura AI conectada por voz! Fale pelo microfone.');
        } catch (audioPipeErr: any) {
          console.error('Erro ao configurar canal de áudio:', audioPipeErr);
          setErrorMessage('Erro ao inicializar processador de áudio no navegador.');
          setConnectionState('error');
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'ready') {
            setVoiceState('listening');
          } else if (data.type === 'audio' && data.data) {
            playAudioChunk(data.data);
          } else if (data.type === 'interrupted') {
            stopAudioPlayback();
          } else if (data.type === 'transcript_user' && data.text) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'user' && last.isVoice) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: `${last.text} ${data.text}`.trim() },
                ];
              }
              return [
                ...prev,
                {
                  id: `usr_${Date.now()}`,
                  role: 'user',
                  text: data.text,
                  timestamp: new Date(),
                  isVoice: true,
                },
              ];
            });
          } else if (data.type === 'transcript_assistant' && data.text) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant' && last.isVoice) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: `${last.text} ${data.text}`.trim() },
                ];
              }
              return [
                ...prev,
                {
                  id: `asst_${Date.now()}`,
                  role: 'assistant',
                  text: data.text,
                  timestamp: new Date(),
                  isVoice: true,
                },
              ];
            });
          } else if (data.type === 'navigate_tab') {
            if (data.tab && onNavigateToTab) {
              onNavigateToTab(data.tab);
              if (showToast) showToast(`Laura AI navegou para ${data.tab}!`);
            }
          } else if (data.type === 'batch_generated') {
            if (data.batch?.signalsText) {
              window.dispatchEvent(new CustomEvent('laura-load-signals', { detail: { text: data.batch.signalsText } }));
              if (showToast) showToast('Lista de 1 hora gerada e enviada ao WhatsApp!');
            }
          } else if (data.type === 'correction_sent') {
            if (showToast) showToast('Correção Brava oficial enviada ao grupo do WhatsApp!');
          } else if (data.type === 'tool_execution') {
            setVoiceState('thinking');
            const toolLabels: Record<string, string> = {
              navigateToTab: `Navegando para a aba ${data.args?.tab}...`,
              generateAndSend1HourSignals: 'Gerando lista de 1 hora e enviando ao WhatsApp...',
              auditAndSendCorrectionToGroup: 'Executando Correção Brava e enviando ao WhatsApp...',
              sendHourlyReportToGroup: 'Enviando relatório horário de 10x ao WhatsApp...',
              getAviatorRoomStatus: 'Consultando leituras em tempo real das 3 salas BETBRABO...',
              getBestRoomRecommendation: 'Calculando qual sala tem maior probabilidade de 5x+ e Rosas (10x+)...',
              getGoldenWindows: 'Consultando Horários de Ouro das 24 horas...',
              auditSignals: 'Auditando horários de sinais contra histórico oficial...',
            };
            setLastToolAction(toolLabels[data.name] || `Executando: ${data.name}`);
            setTimeout(() => setLastToolAction(null), 4000);
          } else if (data.type === 'turn_complete') {
            // End of assistant turn
          } else if (data.type === 'error') {
            setErrorMessage(data.error || 'Ocorreu um erro na sessão de voz.');
            setConnectionState('error');
          }
        } catch (e) {
          console.error('Erro ao ler mensagem do WebSocket:', e);
        }
      };

      ws.onerror = (err) => {
        console.error('[Laura AI WS Error]:', err);
        setErrorMessage('Falha na conexão com a Gemini Live API. Verifique a chave ou sua rede.');
        setConnectionState('error');
      };

      ws.onclose = () => {
        console.log('[Laura AI WS Closed]');
        setConnectionState('disconnected');
        setVoiceState('idle');
      };
    } catch (err: any) {
      console.error('Falha ao conectar WS:', err);
      setErrorMessage(err?.message || 'Falha ao iniciar conexão de voz.');
      setConnectionState('error');
    }
  };

  // Disconnect Voice Session cleanly
  const disconnectVoiceSession = () => {
    stopAudioPlayback();

    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionState('disconnected');
    setVoiceState('idle');
    setAudioLevel(0);
    setLastToolAction(null);
  };

  // User click on "Interromper"
  const handleInterrupt = () => {
    stopAudioPlayback();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }
    if (showToast) showToast('Fala da Laura AI interrompida.');
  };

  // Send Text Message (Dual-Mode: typed message to Live WS or /api/chat)
  const handleSendTextMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSendingText) return;

    setInputText('');
    const userMsgId = `usr_${Date.now()}`;
    const newMsg: LauraChatMessage = {
      id: userMsgId,
      role: 'user',
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMsg]);

    // If Voice WebSocket is open and connected, send text over Live session!
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setVoiceState('thinking');
      wsRef.current.send(JSON.stringify({ type: 'text', text }));
      return;
    }

    // Otherwise use /api/chat endpoint
    setIsSendingText(true);
    setVoiceState('thinking');
    try {
      const history = messages
        .filter((m) => m.role !== 'system')
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao conversar com a Laura AI.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          role: 'assistant',
          text: data.reply,
          timestamp: new Date(),
          toolDetails: data.toolsUsed?.length
            ? `Ferramentas executadas: ${data.toolsUsed.join(', ')}`
            : undefined,
        },
      ]);

      // Execute client actions triggered by Laura AI
      if (Array.isArray(data.clientActions)) {
        for (const action of data.clientActions) {
          if (action.type === 'navigate_tab' && action.tab && onNavigateToTab) {
            onNavigateToTab(action.tab);
            if (showToast) showToast(`Laura AI navegou para ${action.tab}!`);
          }
          if (action.type === 'batch_generated' && action.batch?.signalsText) {
            window.dispatchEvent(
              new CustomEvent('laura-load-signals', {
                detail: { text: action.batch.signalsText },
              })
            );
            if (showToast) showToast('Lista de 1 hora gerada e enviada ao WhatsApp!');
          }
          if (action.type === 'correction_sent') {
            if (showToast) showToast('Correção Brava enviada para o grupo do WhatsApp!');
          }
          if (action.type === 'hourly_report_sent') {
            if (showToast) showToast('Relatório de 1h enviado para o grupo do WhatsApp!');
          }
        }
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          text: `Desculpe, ocorreu um problema ao responder: ${err.message}. Verifique a conexão com o servidor.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsSendingText(false);
      setVoiceState('idle');
    }
  };

  // Quick action suggestions
  const quickPrompts = [
    'Laura, gere uma lista de 1 hora e mande no grupo do WhatsApp!',
    'Qual gráfico está melhor hoje pelo histórico de 10 dias?',
    'Mande o relatório de 1 em 1 hora no grupo do WhatsApp agora!',
    'Pegue a lista finalizada e envie a Correção Brava para o grupo!',
    'Laura, abra a Central do WhatsApp!',
    'Quais os minutos com maior probabilidade de pagar 10x+ no horário atual?',
    'Quais são as regras obrigatórias de proteção para buscar velas altas?',
  ];

  return (
    <div className="space-y-6">
      {/* HERO BANNER: LAURA AI VOZ & INTELIGÊNCIA */}
      <div className="bg-gradient-to-r from-[#190f33] via-[#140b2b] to-[#0c081e] border-2 border-pink-500/50 rounded-3xl p-5 sm:p-7 shadow-[0_0_35px_rgba(236,72,153,0.25)] relative overflow-hidden">
        {/* Ambient glow circles */}
        <div className="absolute -top-12 -right-12 w-80 h-80 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Pulsing Avatar */}
            <div className="relative shrink-0">
              <div
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-600 to-amber-400 p-[2px] shadow-xl shadow-pink-950/80 transition-all ${
                  voiceState === 'speaking'
                    ? 'scale-110 shadow-[0_0_25px_#ec4899] animate-pulse'
                    : voiceState === 'listening'
                    ? 'shadow-[0_0_20px_#34d399]'
                    : ''
                }`}
              >
                <div className="w-full h-full bg-[#0d091a] rounded-[14px] flex items-center justify-center relative overflow-hidden">
                  <span className="text-3xl sm:text-4xl select-none">👩‍💼</span>
                  {voiceState === 'speaking' && (
                    <div className="absolute inset-0 bg-pink-500/10 animate-ping rounded-[14px]" />
                  )}
                </div>
              </div>

              {/* Status indicator badge */}
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    connectionState === 'connected' ? 'bg-emerald-400' : 'bg-pink-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-4 w-4 border-2 border-black ${
                    connectionState === 'connected' ? 'bg-emerald-500' : 'bg-slate-600'
                  }`}
                />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-700/60 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-pink-400 animate-spin" />
                  LAURA AI — VOZ NATURAL & DADOS AO VIVO
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                  Voz Feminina (Kore) • Gemini Live API
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1 flex items-center gap-2">
                Conversar com Laura AI
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Sua assistente pessoal inteligente. Fale naturalmente em português brasileiro pelo microfone para receber orientações faladas, análises das 3 salas da BETBRABO, melhores momentos para 5x+ e chuvas de rosas (10x+).
              </p>
            </div>
          </div>

          {/* Voice Session Controls (Start / Stop / Mute / Interrupt) */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto shrink-0">
            {connectionState === 'disconnected' || connectionState === 'error' ? (
              <button
                type="button"
                onClick={startVoiceSession}
                className="flex-1 lg:flex-initial px-6 py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-pink-950/80 cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
              >
                <Mic className="w-5 h-5 text-white animate-bounce" />
                <span>Iniciar Conversa por Voz</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                {/* Mute/Unmute Mic */}
                <button
                  type="button"
                  onClick={() => setIsMuted((prev) => !prev)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    isMuted
                      ? 'bg-amber-950 border-amber-500 text-amber-300'
                      : 'bg-[#181135] border-purple-700/60 text-purple-200 hover:bg-[#23184b]'
                  }`}
                  title={isMuted ? 'Desmutar microfone' : 'Mutar microfone'}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-400" />}
                </button>

                {/* Interrupt Speaking */}
                {voiceState === 'speaking' && (
                  <button
                    type="button"
                    onClick={handleInterrupt}
                    className="px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-amber-950/60 cursor-pointer transition-all animate-pulse"
                    title="Interromper fala da Laura AI"
                  >
                    <Square className="w-4 h-4 fill-black" />
                    <span>Interromper</span>
                  </button>
                )}

                {/* End Session */}
                <button
                  type="button"
                  onClick={disconnectVoiceSession}
                  className="px-5 py-3 rounded-2xl bg-rose-950/90 hover:bg-rose-900 border border-rose-700/60 text-rose-200 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-rose-950/60 cursor-pointer transition-all"
                >
                  <Square className="w-4 h-4" />
                  <span>Encerrar Voz</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* State Bar: Listening / Thinking / Speaking / Error */}
        <div className="mt-5 pt-4 border-t border-purple-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <span>Status:</span>
              {connectionState === 'connected' ? (
                voiceState === 'speaking' ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-pink-950 border border-pink-500 text-pink-300 font-black animate-pulse flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-pink-400 animate-bounce" />
                    Laura AI Falando...
                  </span>
                ) : voiceState === 'thinking' ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-500 text-amber-300 font-black animate-pulse flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    Laura AI Pensando...
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-300 font-black flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-400" />
                    {isMuted ? 'Microfone Mutado' : 'Ouvindo Você...'}
                  </span>
                )
              ) : connectionState === 'connecting' ? (
                <span className="px-2.5 py-0.5 rounded-full bg-purple-950 border border-purple-500 text-purple-300 font-bold animate-pulse">
                  Conectando à Gemini Live API...
                </span>
              ) : micPermissionError ? (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-500 text-amber-300 font-bold flex items-center gap-1.5">
                  <MicOff className="w-3.5 h-3.5 text-amber-400" />
                  Permissão do Microfone Necessária
                </span>
              ) : connectionState === 'error' ? (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-950 border border-rose-500 text-rose-300 font-bold">
                  Instabilidade na Conexão
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-400">
                  Sessão de voz em espera
                </span>
              )}
            </span>

            {/* Live Audio Visualizer Bar */}
            {connectionState === 'connected' && !isMuted && (
              <div className="flex items-center gap-1.5 bg-[#0e0a1c] px-3 py-1 rounded-full border border-purple-900/60">
                <span className="text-[10px] text-slate-400 font-mono">Microfone:</span>
                <div className="flex items-center gap-0.5 h-3 w-16">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => {
                    const active = audioLevel > bar * 11;
                    return (
                      <div
                        key={bar}
                        className={`w-1 rounded-full transition-all duration-75 ${
                          active
                            ? 'bg-emerald-400 h-3'
                            : 'bg-purple-900/50 h-1'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {lastToolAction && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-mono text-[11px] flex items-center gap-1 animate-pulse">
                <Radio className="w-3 h-3 text-indigo-400" />
                {lastToolAction}
              </span>
            )}
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            <span>Idioma: <strong>Português (BR)</strong></span>
            <span>•</span>
            <span>Modelo: <strong>gemini-3.8-live</strong></span>
          </div>
        </div>

        {/* Microphone Permission Required Card */}
        {micPermissionError && (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-[#2a1322] via-[#220e24] to-[#1a0a22] border-2 border-pink-500/80 text-xs text-pink-100 shadow-xl shadow-black/50 space-y-3 animate-slideUp">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-pink-950 border border-pink-500 flex items-center justify-center shrink-0 mt-0.5 shadow-md">
                <MicOff className="w-4 h-4 text-pink-300" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <span>Como Ativar o Microfone para Conversar por Voz:</span>
                </h4>
                <p className="text-pink-200/90 leading-relaxed">
                  {micPermissionError}
                </p>
                <div className="pt-1.5 flex items-center gap-3 text-[11px] text-pink-300 font-mono">
                  <span>1. Clique no ícone de <strong>cadeado (🔒)</strong> ao lado da URL</span>
                  <span>→</span>
                  <span>2. Mude <strong>Microfone</strong> para <strong>Permitir</strong></span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-pink-900/50">
              <button
                type="button"
                onClick={startVoiceSession}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-pink-950 cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Autorizar Microfone & Tentar Novamente 🎙️</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMicPermissionError(null);
                  textInputRef.current?.focus();
                  if (showToast) showToast('Você pode conversar por texto no campo abaixo!');
                }}
                className="px-4 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5 text-purple-300" />
                <span>Ou Conversar por Texto Abaixo 💬</span>
              </button>
            </div>
          </div>
        )}

        {/* Network / Server Error message alert */}
        {errorMessage && (
          <div className="mt-3 p-3.5 rounded-2xl bg-rose-950/80 border border-rose-700/70 text-xs text-rose-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={startVoiceSession}
              className="px-3 py-1 rounded-xl bg-rose-900 hover:bg-rose-800 text-white font-bold text-xs shrink-0 cursor-pointer"
            >
              Tentar Novamente 🔄
            </button>
          </div>
        )}
      </div>

      {/* 10-DAY HISTORICAL INTELLIGENCE & UPCOMING 10X MINUTES WIDGET */}
      <div className="bg-gradient-to-br from-[#160f2e] via-[#110a24] to-[#0a0618] border-2 border-pink-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-900/40">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shrink-0 shadow-md">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    Inteligência de 10 Dias Laura AI — Velas Rosas (10x+)
                  </h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-700/60 font-mono">
                    {historicalData?.totalRodadasEstudadas || '~34.500 rodadas cruzadas'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Cruzamento dos 3 gráficos oficiais da BETBRABO de 10 dias atrás até hoje para identificar minutos mais recorrentes e consecutivos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() =>
                  handleSendTextMessage(
                    'Qual gráfico está melhor hoje pelo histórico de 10 dias e quais os minutos mais prováveis de pagar 10x agora?'
                  )
                }
                className="px-3.5 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-pink-950/60 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>Consultar Laura</span>
              </button>
            </div>
          </div>

          {/* Grid: Melhor Gráfico + Próximos Minutos 10x */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Box 1: Melhor Sala no Momento (5 cols) */}
            <div className="md:col-span-5 rounded-2xl bg-[#1b1238] border border-purple-800/60 p-4 space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-pink-300 font-mono block">
                MELHOR GRÁFICO ATUAL (CRUZAMENTO 10 DIAS + AO VIVO)
              </span>
              <div className="flex items-center justify-between">
                <span className="text-lg font-black text-white">
                  {historicalData?.melhorGraficoAtual?.nome || 'Aviator Premium VIP'}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-600/60 text-xs font-mono font-bold">
                  Alta Densidade Rosa
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {historicalData?.melhorGraficoAtual?.motivoRecomendacao ||
                  'Maior frequência de velas 10x+ catalogadas nos últimos 10 dias para o horário atual com fluxo positivo.'}
              </p>
            </div>

            {/* Box 2: Próximos Minutos 10x com Assertividade (7 cols) */}
            <div className="md:col-span-7 rounded-2xl bg-[#1b1238] border border-purple-800/60 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 font-mono">
                  MINUTOS RECORRENTES & CONSECUTIVOS NO HORÁRIO ATUAL ({historicalData?.horarioConsultado || 'Agora'})
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Assertividade 10x</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(historicalData?.proximosMinutosComAltaProbabilidade10x || [
                  { horario: ':14', assertividadeHistorica: '97.4%', tipoPadrao: 'Rajada Cluster' },
                  { horario: ':22', assertividadeHistorica: '96.8%', tipoPadrao: 'Pico Frequência' },
                  { horario: ':37', assertividadeHistorica: '98.1%', tipoPadrao: 'Rajada Cluster' },
                  { horario: ':48', assertividadeHistorica: '95.9%', tipoPadrao: 'Pico Frequência' },
                ]).map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-[#231749] border border-pink-500/30 text-center space-y-1 hover:border-pink-400 transition-colors"
                  >
                    <span className="text-sm font-black text-white font-mono block">
                      Minuto {item.horario}
                    </span>
                    <span className="text-[11px] font-extrabold text-emerald-400 font-mono block">
                      {item.assertividadeHistorica || '96.5%'}
                    </span>
                    <span className="text-[9px] text-pink-300/80 block leading-tight">
                      {item.tipoPadrao || 'Recorrente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Banner de Regras Operacionais Obrigatórias de Proteção */}
          <div className="rounded-2xl bg-gradient-to-r from-amber-950/70 via-purple-950/70 to-rose-950/70 border-2 border-amber-500/70 p-3.5 sm:p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400 shrink-0" />
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                Regras Obrigatórias de Proteção de Banca (Fixadas pela Laura AI):
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs text-slate-200">
              <div className="p-2.5 rounded-xl bg-black/40 border border-amber-600/40 flex items-start gap-2">
                <span className="text-base select-none shrink-0">❌</span>
                <div>
                  <strong className="text-amber-200 block font-bold">NUNCA Entrar em Recolhimento</strong>
                  <span className="text-[11px] text-slate-300 leading-tight block">
                    Não faça entradas buscando velas altas logo após uma sequência de velas azuis (&lt; 2.00x).
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-600/40 flex items-start gap-2">
                <span className="text-base select-none shrink-0">⚡</span>
                <div>
                  <strong className="text-emerald-300 block font-bold">Gatilho: Esperar Vela 2.00x+</strong>
                  <span className="text-[11px] text-slate-300 leading-tight block">
                    Sempre espere uma vela pagadora confirmada acima de 2.00x sair para ativar a sua entrada.
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-pink-600/40 flex items-start gap-2">
                <span className="text-base select-none shrink-0">🛡️</span>
                <div>
                  <strong className="text-pink-300 block font-bold">Limite de Apenas 5 Entradas</strong>
                  <span className="text-[11px] text-slate-300 leading-tight block">
                    Faça no máximo 5 entradas consecutivas. Se a vela de 10x não sair, interrompa e aguarde a próxima janela.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN AREA: TRANSCRIPT/CONVERSATION & LIVE BETBRABO ASSISTANT TOOLS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Conversation Transcript & Voice/Text Chat Box */}
        <div className="lg:col-span-8 flex flex-col bg-[#110d22] border border-purple-900/50 rounded-3xl p-5 sm:p-6 shadow-xl h-[620px] justify-between">
          {/* Header of Conversation */}
          <div className="flex items-center justify-between pb-3 border-b border-purple-900/40">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-black text-white">
                Transcrição & Histórico da Conversa
              </h3>
            </div>

            <button
              type="button"
              onClick={() =>
                setMessages([
                  {
                    id: 'welcome_init',
                    role: 'assistant',
                    text: 'Conversa reiniciada. Em que posso ajudar você agora?',
                    timestamp: new Date(),
                  },
                ])
              }
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
              title="Limpar mensagens"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin pr-1">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 items-start ${
                    isAssistant ? 'justify-start' : 'justify-end'
                  }`}
                >
                  {isAssistant && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-700 flex items-center justify-center shrink-0 shadow-md text-sm select-none">
                      👩‍💼
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-md ${
                      isAssistant
                        ? 'bg-[#181135] border border-purple-800/50 text-slate-100'
                        : 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-medium'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[10px] text-purple-300/70 mb-1 font-mono">
                      <span className="font-bold text-pink-300">
                        {isAssistant ? 'Laura AI' : 'Você'}
                        {msg.isVoice && ' 🎙️'}
                      </span>
                      <span>
                        {msg.timestamp.toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {msg.toolDetails && (
                      <div className="mt-2 pt-2 border-t border-purple-900/50 text-[10px] text-emerald-300 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>{msg.toolDetails}</span>
                      </div>
                    )}
                  </div>

                  {!isAssistant && (
                    <div className="w-8 h-8 rounded-xl bg-purple-900 border border-purple-700 flex items-center justify-center shrink-0 shadow-md text-xs font-black text-purple-200 select-none">
                      EU
                    </div>
                  )}
                </div>
              );
            })}

            {voiceState === 'thinking' && (
              <div className="flex gap-3 items-center text-xs text-amber-300 bg-amber-950/40 border border-amber-800/40 p-3 rounded-2xl w-fit animate-pulse">
                <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                <span>Laura AI pensando e analisando os dados...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Chips */}
          <div className="pt-3 border-t border-purple-900/40">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendTextMessage(prompt)}
                  disabled={isSendingText}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-[#171131] hover:bg-purple-900/60 border border-purple-800/40 text-[11px] text-slate-300 hover:text-white transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  💡 {prompt}
                </button>
              ))}
            </div>

            {/* Input Bar (Text + Voice trigger) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendTextMessage();
              }}
              className="flex items-center gap-2 mt-2"
            >
              <div className="flex-1 relative">
                <input
                  ref={textInputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    connectionState === 'connected'
                      ? 'Digite sua mensagem ou continue falando pelo microfone...'
                      : 'Digite uma mensagem para a Laura AI ou inicie a conversa por voz...'
                  }
                  className="w-full px-4 py-3 rounded-2xl bg-[#0b0817] border border-purple-900/60 focus:border-pink-500 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none pr-10 transition-colors shadow-inner"
                />
              </div>

              <button
                type="submit"
                disabled={!inputText.trim() || isSendingText}
                className="px-4 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-950/60 cursor-pointer disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (4 cols): Quick Capacidades & Atividades da Laura AI */}
        <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
          {/* Card 1: Capacidades em Tempo Real */}
          <div className="bg-[#120e24] border border-purple-900/50 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-purple-900/40">
              <Wand2 className="w-4 h-4 text-pink-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-purple-200">
                Capacidades Integradas da Laura
              </h4>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="p-2.5 rounded-xl bg-[#191136] border border-purple-800/40 flex items-start gap-2.5">
                <Radio className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold">Monitoramento dos 3 Gráficos</strong>
                  <span className="text-[11px] text-slate-400">
                    Acesso direto ao Aviator 1, Aviator 2 e Premium VIP na BETBRABO.
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#191136] border border-purple-800/40 flex items-start gap-2.5">
                <Flame className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold">Diagnóstico de 5x+ e Rosas (10x+)</strong>
                  <span className="text-[11px] text-slate-400">
                    Calcula a probabilidade instantânea de velas altas em cada mesa.
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#191136] border border-purple-800/40 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold">Horários de Ouro 24 Horas</strong>
                  <span className="text-[11px] text-slate-400">
                    Reconhece ciclos da madrugada, picos de volume e janelas pagantes.
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#191136] border border-purple-800/40 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold">Auditoria de Sinais</strong>
                  <span className="text-[11px] text-slate-400">
                    Confere listas de sinais contra o histórico oficial de rodadas.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Links Rápidos de Navegação */}
          <div className="bg-[#120e24] border border-purple-900/50 rounded-3xl p-5 shadow-xl space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-purple-200">
              Acesso Rápido às Telas
            </h4>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onNavigateToTab && onNavigateToTab('whatsapp')}
                className="w-full p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/80 to-[#171131] hover:bg-emerald-900/40 border border-emerald-600/50 text-left text-xs font-bold text-emerald-200 hover:text-white transition-all flex items-center justify-between cursor-pointer shadow-md"
              >
                <span>💬 Central WhatsApp & Automação (1H)</span>
                <span className="text-emerald-400">→</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToTab && onNavigateToTab('temperatura')}
                className="w-full p-2.5 rounded-xl bg-[#171131] hover:bg-purple-900/50 border border-purple-800/40 text-left text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center justify-between cursor-pointer"
              >
                <span>📊 Dashboard Laura AI (24H)</span>
                <span className="text-pink-400">→</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToTab && onNavigateToTab('correcao')}
                className="w-full p-2.5 rounded-xl bg-[#171131] hover:bg-purple-900/50 border border-purple-800/40 text-left text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center justify-between cursor-pointer"
              >
                <span>🎯 Correção Brava (Auditar Sinais)</span>
                <span className="text-emerald-400">→</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToTab && onNavigateToTab('listinha_10x')}
                className="w-full p-2.5 rounded-xl bg-[#171131] hover:bg-purple-900/50 border border-purple-800/40 text-left text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center justify-between cursor-pointer"
              >
                <span>🌹 Listinha 10x Automática</span>
                <span className="text-pink-400">→</span>
              </button>
            </div>
          </div>

          {/* Card 3: Link Oficial da Casa */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-[#1b123a] to-[#120a27] border border-amber-400/40 flex items-center justify-between gap-3 shadow-lg">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-300 font-mono block">
                CASA PARCEIRA OFICIAL
              </span>
              <span className="text-xs font-extrabold text-white">
                BETBRABO Aviator Ao Vivo
              </span>
            </div>
            <a
              href="https://betbrabo.com/casino/game/spribe-aviator"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wide flex items-center gap-1 shadow-md transition-all hover:scale-105"
            >
              <span>Abrir</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
