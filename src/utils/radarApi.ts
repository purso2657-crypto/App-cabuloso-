import { AviatorCandle, AviatorFeedChannel, RadarApiResponse, RadarAviatorCandle, RadarChannelInfo } from '../types';

export const RADAR_DEFAULT_CASA = 'BETBRABO';

export const RADAR_CHANNELS: Record<AviatorFeedChannel, RadarChannelInfo> = {
  aviator_1: {
    id: 'aviator_1',
    name: 'Aviator 1',
    title: 'Gráfico Aviator 1 (Sala 1)',
    shortName: 'Aviator 1',
    badge: 'SALA 1',
    apiName: 'broadcast.php',
    description: 'Feed oficial de alta frequência Sala 1 BETBRABO',
    apiUrl: 'https://www.radar-aviator.com/broadcast.php',
    proxyUrl: '/api/radar/broadcast',
    brokerUrl: 'https://www.betbrabo.com/casino/spribe/aviator',
    color: 'cyan',
    accentHex: '#06b6d4',
  },
  radar_ao_vivo: {
    id: 'radar_ao_vivo',
    name: 'Aviator VIP',
    title: 'Gráfico Aviator VIP (Radar Ao Vivo)',
    shortName: 'Aviator VIP',
    badge: 'VIP RADAR',
    apiName: 'broadcast2.php',
    description: 'Feed oficial analítico de leitura de momento BETBRABO',
    apiUrl: 'https://www.radar-aviator.com/broadcast2.php',
    proxyUrl: '/api/radar/broadcast2',
    brokerUrl: 'https://www.betbrabo.com/casino/spribe/aviator-vip',
    color: 'purple',
    accentHex: '#a855f7',
  },
  aviator_premium: {
    id: 'aviator_premium',
    name: 'Aviator Premium',
    title: 'Gráfico Aviator Premium',
    shortName: 'Aviator Premium',
    badge: 'PREMIUM VIP',
    apiName: 'broadcast3.php',
    description: 'Feed oficial VIP de inteligência artificial BETBRABO',
    apiUrl: 'https://www.radar-aviator.com/broadcast3.php',
    proxyUrl: '/api/radar/broadcast3',
    brokerUrl: 'https://www.betbrabo.com/casino/spribe/aviator-premium',
    color: 'amber',
    accentHex: '#f59e0b',
  },
};

export const RADAR_API_BASE_URL = RADAR_CHANNELS.radar_ao_vivo.apiUrl;

/**
 * Fetches real-time Aviator broadcast data from radar-aviator.com for specified channel
 * Channels: 'aviator_1' (broadcast.php), 'radar_ao_vivo' (broadcast2.php), 'aviator_premium' (broadcast3.php)
 * Supports BETBRABO house with cache-busting timestamp.
 * Tries local proxy first, then fallbacks to CORS proxies.
 */
export async function fetchRadarBroadcast(
  channel: AviatorFeedChannel = 'radar_ao_vivo',
  casa: string = RADAR_DEFAULT_CASA
): Promise<RadarApiResponse> {
  const channelInfo = RADAR_CHANNELS[channel] || RADAR_CHANNELS.radar_ao_vivo;
  const ts = Date.now();
  const directTargetUrl = `${channelInfo.apiUrl}?casa=${encodeURIComponent(casa)}&_=${ts}`;
  const proxyPath = `${channelInfo.proxyUrl}?casa=${encodeURIComponent(casa)}&_=${ts}`;
  const localProxyUrl = typeof window !== 'undefined' ? proxyPath : `http://localhost:3000${proxyPath}`;

  const endpointsToTry = [
    // 1. Local Vite / Express proxy route
    localProxyUrl,
    // 2. Direct attempt
    directTargetUrl,
    // 3. Fallback A: allorigins proxy
    `https://api.allorigins.win/raw?url=${encodeURIComponent(directTargetUrl)}`,
    // 4. Fallback B: corsproxy.io
    `https://corsproxy.io/?${encodeURIComponent(directTargetUrl)}`,
  ];

  let lastError: Error | null = null;

  for (const url of endpointsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      if (data && (data.ok === true || Array.isArray(data.historico) || data.ultimaVela)) {
        return data as RadarApiResponse;
      }
    } catch (err: any) {
      lastError = err;
      // continue to next endpoint fallback
    }
  }

  throw new Error(
    lastError?.message ||
      `Não foi possível conectar à API ${channelInfo.name} (${channelInfo.apiName}). Verifique sua conexão.`
  );
}

/**
 * Converts a single Radar candle from API to app's AviatorCandle format
 */
export function convertRadarCandleToAviatorCandle(
  rc: RadarAviatorCandle,
  graphicId: string = 'BETBRABO'
): AviatorCandle {
  const parts = (rc.t || '').trim().split(' ');
  const datePart = parts[0] || ''; // YYYY-MM-DD
  const timePart = parts[1] || '00:00:00'; // HH:MM:SS

  // Format YYYY-MM-DD to DD/MM/YYYY
  let formattedDate = datePart;
  if (datePart.includes('-')) {
    const [y, m, d] = datePart.split('-');
    if (d && m && y) {
      formattedDate = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }

  const dateTime = new Date(`${datePart}T${timePart}`);
  const timestamp = isNaN(dateTime.getTime()) ? Date.now() : dateTime.getTime();
  const roundId = String(rc.rodada || rc.id || Math.floor(timestamp / 1000));

  return {
    id: `radar-${graphicId}-${roundId}`,
    roundId,
    graphicId,
    date: formattedDate,
    time: timePart,
    dateTime: isNaN(dateTime.getTime()) ? new Date() : dateTime,
    timestamp,
    multiplier: Number(rc.mult) || 1.0,
    rawMultiplierStr: `${Number(rc.mult).toFixed(2)}x`,
  };
}

/**
 * Converts the full historico array from Radar API into AviatorCandle[]
 * Orders chronologically: oldest first -> newest last
 */
export function convertRadarHistoryToCandles(
  historico: RadarAviatorCandle[],
  graphicId: string = 'BETBRABO'
): AviatorCandle[] {
  if (!Array.isArray(historico)) return [];

  const candles = historico.map((rc) => convertRadarCandleToAviatorCandle(rc, graphicId));

  // Sort chronologically (oldest first, newest last)
  candles.sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return Number(a.roundId) - Number(b.roundId);
  });

  return candles;
}

/**
 * Merges incoming candles from live polling into existing candles, avoiding duplicates
 */
export function mergeCandles(
  existing: AviatorCandle[],
  incoming: AviatorCandle[]
): AviatorCandle[] {
  const map = new Map<string, AviatorCandle>();

  // Add existing
  for (const c of existing) {
    const key = `${c.date}_${c.roundId || c.time}_${c.multiplier}`;
    map.set(key, c);
  }

  // Add incoming (will update or add new)
  for (const c of incoming) {
    const key = `${c.date}_${c.roundId || c.time}_${c.multiplier}`;
    map.set(key, c);
  }

  const merged = Array.from(map.values());

  // Sort chronologically
  merged.sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return (a.roundId || '').localeCompare(b.roundId || '');
  });

  return merged;
}
