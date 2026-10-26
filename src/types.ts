export interface AviatorCandle {
  id: string;
  roundId: string;
  graphicId?: string;
  date: string; // DD/MM/YYYY or YYYY-MM-DD
  time: string; // HH:MM:SS
  dateTime: Date;
  timestamp: number; // Unix timestamp in ms
  multiplier: number;
  rawMultiplierStr: string;
}

export type MultiplierCategory = 'rose' | 'fire' | 'purple' | 'shield' | 'red' | 'not_found';

export interface SignalCorrection {
  signalTime: string; // HH:MM
  signalMinutes: number; // Minutes from midnight (e.g. 14*60 + 25 = 865)
  maxMultiplier: number;
  emoji: string;
  category: MultiplierCategory;
  categoryName: string;
  matchingCandles: AviatorCandle[];
  winningCandle: AviatorCandle | null;
  winningIndex: number; // 0 to 5
  found: boolean;
  formattedLine: string;
}

export interface CorrectionSummary {
  totalSignals: number;
  foundSignals: number;
  roses: number; // >= 10.00x
  fires: number; // 6.00x - 9.99x
  purples: number; // 3.00x - 5.99x
  shields: number; // 2.30x - 2.99x
  reds: number; // < 2.30x
  notFound: number;
  greenRate: number; // Percentage >= 2.30x
  vipTargetRate: number; // Percentage >= 3.00x
  highestMultiplier: number;
  averageMultiplier: number;
}

export interface TelegramTemplateConfig {
  headerTitle: string;
  subHeaderTitle?: string;
  brokerLink: string;
  protecao: string;
  objetivo: string;
  gatilho?: string;
  maxTentativas?: string;
  entradaRule?: string;
  goldenRules?: string[];
  disclaimer?: string;
  candleWindow: number; // default 6
}

export interface PinkSignalResult {
  totalSignals: number;
  daysCount: number;
  forceLevel: number;
  forceHeader: string;
  selectedDates: string[];
  startTime: string;
  endTime: string;
  minSpacingMinutes: number;
  pinkCandles: AviatorCandle[];
  uniqueMinutes: string[];
  allDetectedMinutes: string[];
  removedMinutes: string[];
  minuteStats: Array<{
    minute: string;
    maxMultiplier: number;
    count: number;
    dates: string[];
    candles: AviatorCandle[];
  }>;
  groupedByHourText: string;
  formattedTelegramMessage: string;
}

export type AviatorFeedChannel = 'aviator_1' | 'radar_ao_vivo' | 'aviator_premium';

export interface RadarChannelInfo {
  id: AviatorFeedChannel;
  name: string;
  title: string;
  shortName: string;
  badge: string;
  apiName: string;
  description: string;
  apiUrl: string;
  proxyUrl: string;
  brokerUrl: string;
  color: string;
  accentHex: string;
}

export type SidebarTabId =
  | 'laura_ai'
  | 'whatsapp'
  | 'correcao'
  | 'temperatura'
  | 'aviator_1'
  | 'radar_ao_vivo'
  | 'aviator_premium'
  | 'chuva_pirata'
  | 'surf_roxas'
  | 'listinha_10x'
  | 'dez_x_bolso'
  | 'maxima_10_20'
  | 'maxima_50'
  | 'mil_x'
  | 'duplas_x';

export interface WhatsAppDispatch {
  id: string;
  timestamp: string; // ISO or HH:MM:SS
  type: 'signals_1h' | 'correction' | 'hourly_report' | 'custom';
  title: string;
  groupId: string;
  groupName: string;
  content: string;
  status: 'sent' | 'delivered' | 'read' | 'pending';
}

export interface SignalBatch {
  id: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  roomKey: string;
  roomName: string;
  signalsCount: number;
  signalsText: string;
  signalsList: string[];
  status: 'active' | 'completed' | 'audited';
  createdAt: string;
  targetGroupId: string;
  targetGroupName: string;
  auditResult?: any;
}

export interface WhatsAppRealGroup {
  id: string;
  name: string;
  participantsCount?: number;
  isAdmin?: boolean;
  creationTime?: string;
  pictureUrl?: string;
  source?: 'api_synced' | 'manual_link' | 'preset';
}

export interface WhatsAppApiConfig {
  engine: 'evolution' | 'zapi' | 'meta_cloud' | 'custom_gateway';
  apiUrl: string;
  apiKey: string;
  instanceName: string;
  isConnected: boolean;
  lastSyncAt?: string;
  error?: string | null;
}

export interface WhatsAppAutomationConfig {
  phoneNumber: string;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  connectionMode?: 'direct_instant' | 'pairing_code' | 'qrcode' | 'real_api';
  connectionError?: string | null;
  lastConnectedAt?: string;
  targetGroupId: string;
  targetGroupName: string;
  availableGroups: WhatsAppRealGroup[];
  apiConfig?: WhatsAppApiConfig;
  autoHourlyReport: boolean;
  autoCorrectAfterBatch: boolean;
  activeBatch: SignalBatch | null;
  lastDispatches: WhatsAppDispatch[];
  lastHourlyReportTime: string | null;
}

export type LauraVoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type LauraConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LauraChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
  isVoice?: boolean;
  toolDetails?: string;
}


export interface RadarAviatorCandle {
  id: number;
  mult: number;
  class: 'azul' | 'roxa' | 'rosa' | string;
  t: string; // "YYYY-MM-DD HH:MM:SS"
  rodada: number;
}

export interface RadarMomento {
  estado: 'recolhendo' | 'pagando' | 'normal' | string;
  motivos: string[];
  score_pagantes: number;
  score_azuis: number;
  regra_3_azuis?: boolean;
  last_update: string;
}

export interface RadarApiResponse {
  ok: boolean;
  ts: string;
  momento?: RadarMomento;
  ultimaVela?: RadarAviatorCandle;
  padroes?: any[];
  sinalAtivo?: any;
  sinalResultado?: any;
  historico?: RadarAviatorCandle[];
}



