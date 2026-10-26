import { AviatorCandle } from '../types';
import * as XLSX from 'xlsx';
import { parseAviatorPDF, exportCandlesToCSV, downloadCSVFile } from './pdfParser';

export { exportCandlesToCSV, downloadCSVFile };

export interface ParseResult {
  candles: AviatorCandle[];
  errors: string[];
  totalLines: number;
  rawText?: string;
}

/**
 * Parses an Aviator Excel file (XLSX / XLS) from an ArrayBuffer or Uint8Array.
 */
export function parseAviatorXLSX(data: ArrayBuffer | Uint8Array): ParseResult {
  try {
    const workbook = XLSX.read(data, {
      type: 'array',
      cellDates: true,
      raw: false,
      dateNF: 'dd/mm/yyyy hh:mm:ss',
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        candles: [],
        errors: ['O arquivo Excel não contém planilhas legíveis.'],
        totalLines: 0,
      };
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert sheet to CSV using semicolon separator to pipe into standard parser
    const csvContent = XLSX.utils.sheet_to_csv(worksheet, {
      FS: ';',
      blankrows: false,
    });

    const parsed = parseAviatorCSV(csvContent);
    return {
      ...parsed,
      rawText: csvContent,
    };
  } catch (err: any) {
    return {
      candles: [],
      errors: [`Erro ao ler arquivo Excel (XLSX): ${err?.message || 'Arquivo corrompido ou formato incompatível.'}`],
      totalLines: 0,
    };
  }
}

/**
 * Helper to clean quotes and whitespace from cell value.
 */
function cleanCellValue(val: string): string {
  let cleaned = (val ?? '').trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

/**
 * Extracts a fallback date from a filename like:
 * "historico-vip-2026-09-24_09h35-a-2026-09-24_23h35.csv" -> "24/09/2026"
 */
function extractDateFromFileName(fileName?: string): string | null {
  if (!fileName) return null;
  // Match YYYY-MM-DD or YYYY_MM_DD
  const ymd = fileName.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
  if (ymd) {
    const [, year, month, day] = ymd;
    return `${day}/${month}/${year}`;
  }
  // Match DD-MM-YYYY or DD_MM_YYYY
  const dmy = fileName.match(/(\d{2})[-_](\d{2})[-_](\d{4})/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${day}/${month}/${year}`;
  }
  return null;
}

/**
 * Parses an Aviator CSV file or text content.
 * Expected format: Gráfico;Rodada;Data;Hora;Multiplicador
 * Also robustly accepts comma, tab, pipe separated, 2/3/4/5 columns, quotes, and various column namings.
 */
export function parseAviatorCSV(csvContent: string, fileName?: string): ParseResult {
  // Strip BOM and clean lines
  const cleanContent = csvContent.replace(/^\uFEFF/, '').trim();
  const lines = cleanContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const candles: AviatorCandle[] = [];
  const errors: string[] = [];

  if (lines.length === 0) {
    return { candles: [], errors: ['O arquivo está vazio.'], totalLines: 0, rawText: csvContent };
  }

  const fallbackDateFromFileName = extractDateFromFileName(fileName);

  // 1. Detect delimiter: semicolon, comma, tab, pipe
  // Examine up to first 10 lines
  const sampleLines = lines.slice(0, 10);
  let semiCount = 0;
  let commaCount = 0;
  let tabCount = 0;
  let pipeCount = 0;

  for (const line of sampleLines) {
    let inQ = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"' || ch === "'") inQ = !inQ;
      if (!inQ) {
        if (ch === ';') semiCount++;
        else if (ch === ',') commaCount++;
        else if (ch === '\t') tabCount++;
        else if (ch === '|') pipeCount++;
      }
    }
  }

  let delimiter = ';';
  if (semiCount >= commaCount && semiCount >= tabCount && semiCount >= pipeCount && semiCount > 0) {
    delimiter = ';';
  } else if (commaCount > semiCount && commaCount >= tabCount && commaCount >= pipeCount) {
    delimiter = ',';
  } else if (tabCount > semiCount && tabCount > commaCount && tabCount >= pipeCount) {
    delimiter = '\t';
  } else if (pipeCount > semiCount && pipeCount > commaCount && pipeCount > tabCount) {
    delimiter = '|';
  }

  // 2. Header detection
  let startIndex = 0;
  let headerMap = {
    graphic: -1,
    round: -1,
    date: -1,
    time: -1,
    dateTime: -1,
    multiplier: -1,
    timestamp: -1,
  };

  const firstCols = splitCSVRow(lines[0], delimiter).map((c) => cleanCellValue(c).toLowerCase());
  const hasHeader = firstCols.some((c) => {
    return (
      c.includes('gráfico') ||
      c.includes('grafico') ||
      c.includes('rodada') ||
      c.includes('round') ||
      c.includes('data') ||
      c.includes('date') ||
      c.includes('dia') ||
      c.includes('hora') ||
      c.includes('horario') ||
      c.includes('horário') ||
      c.includes('time') ||
      c.includes('multiplicador') ||
      c.includes('multiplier') ||
      c.includes('odd') ||
      c.includes('crash') ||
      c.includes('resultado') ||
      c.includes('payout') ||
      c.includes('vela') ||
      c.includes('category') ||
      c.includes('timestamp') ||
      c.includes('flight')
    );
  });

  if (hasHeader) {
    startIndex = 1;
    firstCols.forEach((col, idx) => {
      // 1. Timestamp (epoch ms or s)
      if (col.startsWith('timestamp') || col.includes('timestamp') || col === 'epoch') {
        headerMap.timestamp = idx;
      }
      // 2. Round ID (prefer specific roundid / rodada over generic id)
      else if (col === 'roundid' || col === 'round_id' || col.includes('rodada') || col === 'round') {
        headerMap.round = idx;
      } else if (col === 'id' && headerMap.round === -1) {
        headerMap.round = idx;
      }
      // 3. Graphic / Feed / Room
      else if (col.includes('gráfico') || col.includes('grafico') || col.includes('sala') || col === 'feed') {
        if (headerMap.graphic === -1) headerMap.graphic = idx;
      }
      // 4. Combined Date-Time
      else if (col.includes('data') && (col.includes('hora') || col.includes('time'))) {
        headerMap.dateTime = idx;
      }
      // 5. Date (e.g. date_brt, data, date) - exclude duration
      else if ((col.includes('data') || col.includes('date') || col.includes('dia')) && !col.includes('duration')) {
        if (headerMap.date === -1 || col.includes('brt') || col === 'date' || col === 'data') {
          headerMap.date = idx;
        }
      }
      // 6. Time (e.g. time_brt, hora, time, horario) - exclude timestamp & duration
      else if (
        (col.includes('hora') || col.includes('time') || col.includes('horario') || col.includes('horário')) &&
        !col.includes('duration') &&
        !col.includes('timestamp')
      ) {
        if (headerMap.time === -1 || col.includes('brt') || col === 'time' || col === 'hora') {
          headerMap.time = idx;
        }
      }
      // 7. Multiplier / Crash / Odd
      else if (
        col.includes('multiplicador') ||
        col.includes('multiplier') ||
        col.includes('crash') ||
        col.includes('odd') ||
        col.includes('resultado') ||
        col.includes('payout') ||
        col.includes('vela') ||
        col.includes('valor')
      ) {
        headerMap.multiplier = idx;
      }
    });
  }

  // 3. Parse each row
  let roundSeqCounter = 1;

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;

    const cols = splitCSVRow(rawLine, delimiter).map((c) => cleanCellValue(c));
    if (cols.length < 2) {
      continue;
    }

    try {
      let graphicId = headerMap.graphic !== -1 ? cols[headerMap.graphic] ?? '1' : '1';
      let roundId = headerMap.round !== -1 ? cols[headerMap.round] ?? '' : '';
      let dateStr = headerMap.date !== -1 ? cols[headerMap.date] ?? '' : '';
      let timeStr = headerMap.time !== -1 ? cols[headerMap.time] ?? '' : '';
      let multStr = headerMap.multiplier !== -1 ? cols[headerMap.multiplier] ?? '' : '';

      // Check for combined date-time column
      if (headerMap.dateTime !== -1 && cols[headerMap.dateTime]) {
        const dtVal = cols[headerMap.dateTime];
        const dtParts = dtVal.split(/[T\s]+/);
        if (dtParts.length >= 2) {
          dateStr = dtParts[0];
          timeStr = dtParts[1];
        }
      }

      // Check timestamp column as fallback if time or date is missing
      if ((!timeStr || !dateStr) && headerMap.timestamp !== -1 && cols[headerMap.timestamp]) {
        const tsVal = parseInt(cols[headerMap.timestamp], 10);
        if (!isNaN(tsVal) && tsVal > 0) {
          const d = new Date(tsVal < 10000000000 ? tsVal * 1000 : tsVal);
          if (!timeStr) {
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            const ss = String(d.getSeconds()).padStart(2, '0');
            timeStr = `${hh}:${mm}:${ss}`;
          }
          if (!dateStr) {
            const dd = String(d.getDate()).padStart(2, '0');
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            dateStr = `${dd}/${mo}/${yyyy}`;
          }
        }
      }

      // If headers weren't detected or columns weren't fully matched, smart fallback
      if (!hasHeader || !timeStr || !multStr) {
        if (cols.length >= 5) {
          graphicId = cols[0] || graphicId;
          roundId = cols[1] || roundId;
          dateStr = cols[2] || dateStr;
          timeStr = cols[3] || timeStr;
          multStr = cols[4] || multStr;
        } else if (cols.length === 4) {
          roundId = cols[0] || roundId;
          dateStr = cols[1] || dateStr;
          timeStr = cols[2] || timeStr;
          multStr = cols[3] || multStr;
        } else if (cols.length === 3) {
          // Could be: Date, Time, Multiplier OR Round, Time, Multiplier
          if (cols[0].includes('/') || cols[0].includes('-')) {
            dateStr = cols[0];
            timeStr = cols[1];
            multStr = cols[2];
          } else {
            roundId = cols[0];
            timeStr = cols[1];
            multStr = cols[2];
          }
        } else if (cols.length === 2) {
          // Could be: Time, Multiplier OR Multiplier, Time
          if (normalizeTimeString(cols[0])) {
            timeStr = cols[0];
            multStr = cols[1];
          } else if (normalizeTimeString(cols[1])) {
            timeStr = cols[1];
            multStr = cols[0];
          } else {
            timeStr = cols[0];
            multStr = cols[1];
          }
        }
      }

      // If time or multiplier still empty, scan columns heuristically
      if (!timeStr || !multStr) {
        for (const col of cols) {
          if (!timeStr && normalizeTimeString(col)) {
            timeStr = col;
          } else if (!dateStr && (col.match(/\d{2}[/-]\d{2}[/-]\d{2,4}/) || col.match(/\d{4}[/-]\d{2}[/-]\d{2}/))) {
            dateStr = col;
          } else if (!multStr && (col.toLowerCase().endsWith('x') || col.match(/^\d+([.,]\d+)?$/))) {
            multStr = col;
          }
        }
      }

      // Parse multiplier value (handles "3,45x", "3.45x", "3,45", "3.45", "10x", "10", currency symbols)
      let cleanedMult = multStr
        .replace(/[xX]/gi, '')
        .replace(/[R$€£]/g, '')
        .trim();

      // Handle Brazilian format like 1.234,56 or standard 2,45
      if (cleanedMult.includes('.') && cleanedMult.includes(',')) {
        cleanedMult = cleanedMult.replace(/\./g, '').replace(',', '.');
      } else if (cleanedMult.includes(',')) {
        cleanedMult = cleanedMult.replace(',', '.');
      }

      const multiplier = parseFloat(cleanedMult);
      if (isNaN(multiplier) || multiplier <= 0) {
        continue;
      }

      // Normalize time format to HH:MM:SS
      const normalizedTime = normalizeTimeString(timeStr);
      if (!normalizedTime) {
        continue;
      }

      // Normalize date & create Date object (fallback to filename date or today)
      const effectiveDateStr = dateStr || fallbackDateFromFileName || '';
      const normalizedDate = normalizeDateString(effectiveDateStr);
      const parsedDate = parseDateTime(normalizedDate, normalizedTime);

      const effectiveRoundId = roundId || `R-${roundSeqCounter++}`;

      let candleTimestamp = parsedDate.getTime();
      if (headerMap.timestamp !== -1 && cols[headerMap.timestamp]) {
        const tsVal = parseInt(cols[headerMap.timestamp], 10);
        if (!isNaN(tsVal) && tsVal > 1000000000) {
          candleTimestamp = tsVal < 10000000000 ? tsVal * 1000 : tsVal;
        }
      }

      candles.push({
        id: `candle-${i}-${effectiveRoundId}`,
        roundId: effectiveRoundId,
        graphicId: graphicId || '1',
        date: normalizedDate,
        time: normalizedTime,
        dateTime: parsedDate,
        timestamp: candleTimestamp,
        multiplier,
        rawMultiplierStr: multStr,
      });
    } catch {
      // Skip malformed row
    }
  }

  if (candles.length === 0) {
    errors.push('Não foi possível identificar velas válidas no arquivo.');
  } else {
    // Sort candles chronologically: oldest first -> newest last
    candles.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.roundId.localeCompare(b.roundId);
    });
  }

  return {
    candles,
    errors,
    totalLines: lines.length - startIndex,
    rawText: csvContent,
  };
}

/**
 * Universal Aviator File Reader: accepts File (.xlsx, .xls, .csv, .txt)
 */
export async function parseAviatorFile(file: File): Promise<ParseResult> {
  const fileNameLower = file.name.toLowerCase();

  if (fileNameLower.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer();
    return parseAviatorPDF(arrayBuffer, file.name);
  }

  if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
    const arrayBuffer = await file.arrayBuffer();
    return parseAviatorXLSX(arrayBuffer);
  }

  // Otherwise read as text
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      resolve(parseAviatorCSV(content, file.name));
    };
    reader.onerror = () => {
      resolve({
        candles: [],
        errors: ['Erro ao ler o arquivo.'],
        totalLines: 0,
      });
    };
    reader.readAsText(file, 'UTF-8');
  });
}

function splitCSVRow(row: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeTimeString(timeStr: string): string {
  const cleaned = timeStr.trim();
  const parts = cleaned.split(':');
  if (parts.length === 2) {
    const hh = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    return `${hh}:${mm}:00`;
  } else if (parts.length >= 3) {
    const hh = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    const ss = parts[2].split('.')[0].padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return '';
}

function normalizeDateString(dateStr: string): string {
  const cleaned = (dateStr ?? '').trim();
  if (!cleaned) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // Format: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  // Format: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    let [, d, m, y] = dmyMatch;
    if (y.length === 2) y = `20${y}`;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  return cleaned;
}

function parseDateTime(dateStr: string, timeStr: string): Date {
  const [hh, mm, ss] = timeStr.split(':').map((v) => parseInt(v, 10) || 0);

  let year = new Date().getFullYear();
  let month = new Date().getMonth();
  let day = new Date().getDate();

  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      day = parseInt(parts[0], 10) || day;
      month = (parseInt(parts[1], 10) || 1) - 1;
      year = parseInt(parts[2], 10) || year;
      if (year < 100) year += 2000;
    }
  } else if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10) || year;
        month = (parseInt(parts[1], 10) || 1) - 1;
        day = parseInt(parts[2], 10) || day;
      } else {
        day = parseInt(parts[0], 10) || day;
        month = (parseInt(parts[1], 10) || 1) - 1;
        year = parseInt(parts[2], 10) || year;
        if (year < 100) year += 2000;
      }
    }
  }

  return new Date(year, month, day, hh, mm, ss);
}
