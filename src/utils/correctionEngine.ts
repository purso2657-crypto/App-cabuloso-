import {
  AviatorCandle,
  CorrectionSummary,
  MultiplierCategory,
  SignalCorrection,
  TelegramTemplateConfig,
  PinkSignalResult,
} from '../types';

export const DEFAULT_TELEGRAM_CONFIG: TelegramTemplateConfig = {
  headerTitle: '🚨✈️ RADAR AVIATOR VIP — CORREÇÃO ✈️🚨\n📊 CONFERÊNCIA DOS SINAIS',
  subHeaderTitle: '📊 CONFERÊNCIA DOS SINAIS',
  brokerLink: '🔗 AVIATOR: betbrabo.com/casino/spribe/aviator-vip',
  protecao: '🛡️ Proteção: 2,30x',
  objetivo: '🎯 Objetivo: 3x → 10x',
  gatilho: '🟣 Gatilho: após ROXA',
  maxTentativas: '🔢 Máximo: 5 tentativas',
  candleWindow: 6,
};

/**
 * Extracts all valid HH:MM time strings from user input.
 * Supports lines with extra text like "14:25", "⏰ 14:25", "Entrada: 14:25", etc.
 */
export function extractSignalTimes(rawInput: string): string[] {
  const lines = rawInput.split(/\r?\n/);
  const times: string[] = [];
  const timeRegex = /\b([01]?\d|2[0-3])[:hH]([0-5]\d)\b/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(timeRegex);
    if (match) {
      const hh = match[1].padStart(2, '0');
      const mm = match[2].padStart(2, '0');
      times.push(`${hh}:${mm}`);
    }
  }

  return times;
}

/**
 * Maps a multiplier value to its category, emoji and label.
 * - ❌ → menos de 2,30x
 * - 🛡 → de 2,30x até 2,99x
 * - 🟣 → de 3,00x até 5,99x
 * - 🔥 → de 6,00x até 9,99x
 * - 🌹 → acima de 10,00x
 */
export function getMultiplierCategory(multiplier: number): {
  emoji: string;
  category: MultiplierCategory;
  name: string;
  colorClass: string;
} {
  if (multiplier >= 10.0) {
    return { emoji: '🌹', category: 'rose', name: 'Rosa (10.00x+)', colorClass: 'text-pink-400 font-bold' };
  }
  if (multiplier >= 6.0) {
    return { emoji: '🔥', category: 'fire', name: 'Vela Alta (6.00x - 9.99x)', colorClass: 'text-amber-400 font-bold' };
  }
  if (multiplier >= 3.0) {
    return { emoji: '🟣', category: 'purple', name: 'Roxa (3.00x - 5.99x)', colorClass: 'text-purple-400 font-bold' };
  }
  if (multiplier >= 2.3) {
    return { emoji: '🛡️', category: 'shield', name: 'Proteção (2.30x - 2.99x)', colorClass: 'text-blue-400 font-bold' };
  }
  return { emoji: '❌', category: 'red', name: 'Red (< 2.30x)', colorClass: 'text-rose-500 font-bold' };
}

/**
 * Formats a multiplier number in Brazilian format: "4,85x"
 */
export function formatMultiplierBR(mult: number): string {
  return `${mult.toFixed(2).replace('.', ',')}x`;
}

/**
 * Processes signal times against chronological candles list.
 * Window: first candle starting at the signal minute + subsequent candles up to candleWindow (default 6).
 */
export function processSignalCorrections(
  signalTimes: string[],
  candles: AviatorCandle[],
  candleWindow: number = 6
): {
  corrections: SignalCorrection[];
  summary: CorrectionSummary;
  formattedTelegramMessage: string;
} {
  const corrections: SignalCorrection[] = [];

  for (const signalTime of signalTimes) {
    const [sH, sM] = signalTime.split(':').map((v) => parseInt(v, 10));
    const signalMinutes = sH * 60 + sM;

    // Find the first candle at or after this minute
    let startIndex = -1;

    // First try: exact minute match (e.g. time is 14:25:XX)
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const [cH, cM] = c.time.split(':').map((v) => parseInt(v, 10));
      if (cH === sH && cM === sM) {
        startIndex = i;
        break;
      }
    }

    // Fallback: if no candle at exact minute, find closest candle >= signal time
    if (startIndex === -1) {
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const [cH, cM] = c.time.split(':').map((v) => parseInt(v, 10));
        const cMinutes = cH * 60 + cM;
        if (cMinutes >= signalMinutes && cMinutes <= signalMinutes + 3) {
          startIndex = i;
          break;
        }
      }
    }

    if (startIndex !== -1) {
      const windowCandles = candles.slice(startIndex, startIndex + candleWindow);
      let maxMultiplier = 0;
      let winningCandle: AviatorCandle | null = null;
      let winningIndex = 0;

      windowCandles.forEach((candle, idx) => {
        if (candle.multiplier > maxMultiplier) {
          maxMultiplier = candle.multiplier;
          winningCandle = candle;
          winningIndex = idx;
        }
      });

      const { emoji, category, name } = getMultiplierCategory(maxMultiplier);
      const formattedMult = formatMultiplierBR(maxMultiplier);
      const formattedLine = `⏰ ${signalTime} │ ${formattedMult} ${emoji}`;

      corrections.push({
        signalTime,
        signalMinutes,
        maxMultiplier,
        emoji,
        category,
        categoryName: name,
        matchingCandles: windowCandles,
        winningCandle,
        winningIndex,
        found: true,
        formattedLine,
      });
    } else {
      // Signal time was not found in the dataset
      corrections.push({
        signalTime,
        signalMinutes,
        maxMultiplier: 0,
        emoji: '❌',
        category: 'not_found',
        categoryName: 'Não encontrado no histórico',
        matchingCandles: [],
        winningCandle: null,
        winningIndex: -1,
        found: false,
        formattedLine: `⏰ ${signalTime} │ 1,00x ❌`,
      });
    }
  }

  // Calculate summary metrics
  const totalSignals = corrections.length;
  const foundList = corrections.filter((c) => c.found);
  const foundSignals = foundList.length;

  let roses = 0;
  let fires = 0;
  let purples = 0;
  let shields = 0;
  let reds = 0;
  let notFound = 0;
  let highestMultiplier = 0;
  let totalMultSum = 0;

  corrections.forEach((c) => {
    if (!c.found) {
      notFound++;
      return;
    }
    if (c.maxMultiplier > highestMultiplier) {
      highestMultiplier = c.maxMultiplier;
    }
    totalMultSum += c.maxMultiplier;

    if (c.category === 'rose') roses++;
    else if (c.category === 'fire') fires++;
    else if (c.category === 'purple') purples++;
    else if (c.category === 'shield') shields++;
    else if (c.category === 'red') reds++;
  });

  const greenCount = roses + fires + purples + shields;
  const greenRate = foundSignals > 0 ? Math.round((greenCount / foundSignals) * 1000) / 10 : 0;
  const vipTargetCount = roses + fires + purples; // >= 3.00x
  const vipTargetRate = foundSignals > 0 ? Math.round((vipTargetCount / foundSignals) * 1000) / 10 : 0;
  const averageMultiplier = foundSignals > 0 ? Math.round((totalMultSum / foundSignals) * 100) / 100 : 0;

  const summary: CorrectionSummary = {
    totalSignals,
    foundSignals,
    roses,
    fires,
    purples,
    shields,
    reds,
    notFound,
    greenRate,
    vipTargetRate,
    highestMultiplier,
    averageMultiplier,
  };

  const formattedTelegramMessage = generateTelegramMessage(corrections, DEFAULT_TELEGRAM_CONFIG);

  return {
    corrections,
    summary,
    formattedTelegramMessage,
  };
}

/**
 * Builds the official Telegram message exactly as required by Radar Aviator VIP specifications:
 * - Grouped by hour (19H, 20H, 21H...) with ordinals (PRIMEIRO BLOCO, SEGUNDO BLOCO...)
 * - Formatted lines with "⏰ HH:MM │ XX,XXx [EMOJI]"
 * - Highlights section with largest multiplier at the bottom
 */
export function generateTelegramMessage(
  corrections: SignalCorrection[],
  config: TelegramTemplateConfig = DEFAULT_TELEGRAM_CONFIG
): string {
  if (corrections.length === 0) {
    return '';
  }

  // 1. Group signals chronologically by hour
  const hourMap = new Map<number, SignalCorrection[]>();
  for (const c of corrections) {
    const [hh] = c.signalTime.split(':').map((v) => parseInt(v, 10));
    const hour = isNaN(hh) ? 0 : hh;
    if (!hourMap.has(hour)) {
      hourMap.set(hour, []);
    }
    hourMap.get(hour)!.push(c);
  }

  // Sort hours in ascending order
  const sortedHours = Array.from(hourMap.keys()).sort((a, b) => a - b);

  const ORDINALS = [
    'PRIMEIRO',
    'SEGUNDO',
    'TERCEIRO',
    'QUARTO',
    'QUINTO',
    'SEXTO',
    'SÉTIMO',
    'OITAVO',
    'NONO',
    'DÉCIMO',
    'DÉCIMO PRIMEIRO',
    'DÉCIMO SEGUNDO',
    'DÉCIMO TERCEIRO',
    'DÉCIMO QUARTO',
    'DÉCIMO QUINTO',
    'DÉCIMO SEXTO',
    'DÉCIMO SÉTIMO',
    'DÉCIMO OITAVO',
    'DÉCIMO NONO',
    'VIGÉSIMO',
    'VIGÉSIMO PRIMEIRO',
    'VIGÉSIMO SEGUNDO',
    'VIGÉSIMO TERCEIRO',
    'VIGÉSIMO QUARTO',
  ];

  const blocksText: string[] = [];

  sortedHours.forEach((hour, index) => {
    const signalsInHour = hourMap.get(hour)!;
    signalsInHour.sort((a, b) => a.signalMinutes - b.signalMinutes);

    const ordinalLabel = ORDINALS[index] ? `${ORDINALS[index]} BLOCO` : `${index + 1}º BLOCO`;
    const hourPrefix = getHourBlockHeader(hour);
    const blockHeader = `${hourPrefix} — ${ordinalLabel}`;

    const lines = signalsInHour.map((c) => {
      if (c.found) {
        const formattedMult = formatMultiplierBR(c.maxMultiplier);
        return `⏰ ${c.signalTime} │ ${formattedMult} ${c.emoji}`;
      }
      return `⏰ ${c.signalTime} │ 1,00x ❌`;
    });

    blocksText.push(`${blockHeader}\n\n${lines.join('\n')}`);
  });

  // 2. Highlights (Maior Multiplicador)
  let highestCorrection: SignalCorrection | null = null;
  let highestMultiplier = 0;

  for (const c of corrections) {
    if (c.found && c.maxMultiplier > highestMultiplier) {
      highestMultiplier = c.maxMultiplier;
      highestCorrection = c;
    }
  }

  const highlightSection = highestCorrection
    ? `\n\n━━━━━━━━━━━━━━━━━━\n\n🌹 DESTAQUES DO RADAR\n\n🚀 MAIOR MULTIPLICADOR\n\n${highestCorrection.emoji} ${formatMultiplierBR(highestCorrection.maxMultiplier)}\n⏰ ${highestCorrection.signalTime}`
    : '';

  const headerPart = config.headerTitle;
  const brokerPart = config.brokerLink;
  const protecao = config.protecao || '🛡️ Proteção: 2,30x';
  const objetivo = config.objetivo || '🎯 Objetivo: 3x → 10x';
  const gatilho = config.gatilho || '🟣 Gatilho: após ROXA';
  const maxTentativas = config.maxTentativas || '🔢 Máximo: 5 tentativas';

  return `${headerPart}

${brokerPart}

━━━━━━━━━━━━━━━━━━

⚙️ CONFIGURAÇÃO DO RADAR

${protecao}
${objetivo}
${gatilho}
${maxTentativas}

━━━━━━━━━━━━━━━━━━

📊 RESULTADOS CONFIRMADOS
${blocksText.join('\n\n')}${highlightSection}`;
}

/**
 * Returns the formatted hour header with dynamic emoji based on the time of day:
 * - 🌓 for 05H and 18H (twilight / transition)
 * - 🌙 for 19H to 04H (night / dawn)
 * - ☀️ for 06H to 17H (day)
 * Padded with leading zero (e.g. 05H, 06H, 18H, 19H).
 */
export function getHourBlockHeader(hour: number): string {
  const formattedHour = String(hour).padStart(2, '0') + 'H';
  let emoji = '☀️';
  if (hour === 5 || hour === 18) {
    emoji = '🌓';
  } else if (hour >= 19 || hour <= 4) {
    emoji = '🌙';
  } else {
    emoji = '☀️';
  }
  return `${emoji} ${formattedHour}`;
}

/**
 * Generates Pink Signals (Sinais Rosa >= 10.0x) from historical candles
 * filtered by date(s) and start/end time.
 * Automatically groups by hour with dynamic emoji:
 * 🌓 05H / 18H | 🌙 19H - 04H | ☀️ 06H - 17H
 * and applies minute spacing to avoid consecutive/congested signals.
 */
export function generatePinkSignals(
  candles: AviatorCandle[],
  options: {
    selectedDates?: string[];
    startTime?: string; // HH:MM
    endTime?: string; // HH:MM
    minMultiplier?: number; // default 10.0
    minSpacingMinutes?: number; // default 2 (eliminates consecutive minutes like 20:23 & 20:24)
    brokerLink?: string;
    roomTitle?: string;
  }
): PinkSignalResult {
  const {
    selectedDates = [],
    startTime = '00:00',
    endTime = '23:59',
    minMultiplier = 10.0,
    minSpacingMinutes = 2,
    brokerLink = 'https://www.betbrabo.com/casino/spribe/aviator-vip',
    roomTitle,
  } = options;

  const [startH, startM] = startTime.split(':').map((v) => parseInt(v, 10) || 0);
  const [endH, endM] = endTime.split(':').map((v) => parseInt(v, 10) || 0);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  // Filter candles that meet criteria
  const pinkCandles = candles.filter((candle) => {
    // Multiplier threshold (>= 10x)
    if (candle.multiplier < minMultiplier) return false;

    // Date filtering if selected
    if (selectedDates.length > 0) {
      const cDateClean = (candle.date || '').trim();
      const isMatch = selectedDates.some((sd) => {
        const sClean = (sd || '').trim();
        return (
          sClean === cDateClean ||
          sClean.replace(/-/g, '/') === cDateClean.replace(/-/g, '/') ||
          sClean.replace(/\//g, '-') === cDateClean.replace(/\//g, '-')
        );
      });
      if (!isMatch) return false;
    }

    // Time filtering
    const [cH, cM] = candle.time.split(':').map((v) => parseInt(v, 10) || 0);
    const candleMin = cH * 60 + cM;

    if (startMin <= endMin) {
      if (candleMin < startMin || candleMin > endMin) return false;
    } else {
      // Overnight range, e.g. 22:00 to 04:00
      if (candleMin < startMin && candleMin > endMin) return false;
    }

    return true;
  });

  // Group by minute (HH:MM)
  const minuteMap = new Map<string, { maxMult: number; count: number; dates: Set<string>; candles: AviatorCandle[] }>();

  for (const c of pinkCandles) {
    const minute = c.time.slice(0, 5);
    if (!minuteMap.has(minute)) {
      minuteMap.set(minute, {
        maxMult: c.multiplier,
        count: 1,
        dates: new Set([c.date]),
        candles: [c],
      });
    } else {
      const entry = minuteMap.get(minute)!;
      entry.count += 1;
      if (c.multiplier > entry.maxMult) {
        entry.maxMult = c.multiplier;
      }
      entry.dates.add(c.date);
      entry.candles.push(c);
    }
  }

  // Sorted unique minutes chronologically
  const allDetectedMinutes = Array.from(minuteMap.keys()).sort((a, b) => {
    const [aH, aM] = a.split(':').map((v) => parseInt(v, 10));
    const [bH, bM] = b.split(':').map((v) => parseInt(v, 10));
    return aH * 60 + aM - (bH * 60 + bM);
  });

  // Apply spacing filter (e.g. minSpacingMinutes = 2 drops 20:24 if 20:23 was accepted)
  const filteredMinutes: string[] = [];
  const removedMinutes: string[] = [];
  let lastAcceptedMin = -99999;

  for (const minute of allDetectedMinutes) {
    const [h, m] = minute.split(':').map((v) => parseInt(v, 10));
    const totalMin = h * 60 + m;

    if (minSpacingMinutes > 1 && totalMin - lastAcceptedMin < minSpacingMinutes) {
      removedMinutes.push(minute);
    } else {
      filteredMinutes.push(minute);
      lastAcceptedMin = totalMin;
    }
  }

  const minuteStats = filteredMinutes.map((minute) => {
    const entry = minuteMap.get(minute)!;
    return {
      minute,
      maxMultiplier: entry.maxMult,
      count: entry.count,
      dates: Array.from(entry.dates),
      candles: entry.candles,
    };
  });

  // Group by hour in standard format:
  // ☀️ 19H
  // ⏰ 19:04 •
  // ⏰ 19:13 •
  const hourMap = new Map<number, string[]>();
  for (const minute of filteredMinutes) {
    const [hStr] = minute.split(':');
    const hour = parseInt(hStr, 10);
    if (!hourMap.has(hour)) {
      hourMap.set(hour, []);
    }
    hourMap.get(hour)!.push(minute);
  }

  const sortedHours = Array.from(hourMap.keys()).sort((a, b) => a - b);

  const hourBlocks: string[] = [];
  for (const hour of sortedHours) {
    const mins = hourMap.get(hour)!;
    const hourHeader = getHourBlockHeader(hour);
    const lines = mins.map((m) => `⏰ ${m} •`);
    hourBlocks.push(`${hourHeader}\n${lines.join('\n')}`);
  }

  const groupedByHourText = hourBlocks.length > 0
    ? hourBlocks.join('\n\n')
    : 'Nenhum sinal rosa detectado no intervalo.';

  // Determine force level and header
  const daysCount = selectedDates.length > 0 ? selectedDates.length : 1;
  let forceHeader = '';
  if (daysCount === 2) {
    forceHeader = '🔥 FORÇA NÍVEL 2 🔥\n\n';
  } else if (daysCount >= 3) {
    forceHeader = `🔥 FORÇA NÍVEL ${daysCount} 🔥\n\n`;
  }

  const headerTitle = roomTitle
    ? `🚨✈️ RADAR ${roomTitle.toUpperCase()} — LISTINHA 10X ✈️🚨`
    : '🚨✈️ RADAR AVIATOR VIP — LISTINHA 10X ✈️🚨';

  const formattedTelegramMessage = `${forceHeader}${headerTitle}
📊 LISTA OFICIAL DE VELAS ROSA

🔗 AVIATOR: ${brokerLink}

━━━━━━━━━━━━━━━━━━

⚙️ CONFIGURAÇÃO DO RADAR

🛡️ Proteção: 2,30x
🎯 Objetivo: 3x → 10x
🟣 Gatilho: após ROXA
🔢 Máximo: 5 tentativas

━━━━━━━━━━━━━━━━━━

📊 SINAIS CONFIRMADOS ⤵️

${groupedByHourText}

━━━━━━━━━━━━━━━━━━

🎯 REGRA DE OURO:
💰 USE SEMPRE O GERENCIAMENTO DE BANCA
🎯 Se bater a meta, PARAR as entradas do Dia!
🚫 Não tente recuperar prejuízo
🛑 Bateu 5 entradas? Encerrar o sinal

⚠️ AVISO DE RESPONSABILIDADE ⚠️
O Aviator é um jogo de Análise. Jogue com responsabilidade.
Não aposte dinheiro que você não pode perder.`;

  return {
    totalSignals: filteredMinutes.length,
    daysCount,
    forceLevel: daysCount,
    forceHeader,
    selectedDates,
    startTime,
    endTime,
    minSpacingMinutes,
    pinkCandles,
    uniqueMinutes: filteredMinutes,
    allDetectedMinutes,
    removedMinutes,
    minuteStats,
    groupedByHourText,
    formattedTelegramMessage,
  };
}

