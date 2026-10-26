import * as pdfjsLib from 'pdfjs-dist';
import { AviatorCandle } from '../types';
import { parseAviatorCSV, ParseResult } from './csvParser';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  try {
    // Try Vite's asset URL resolution first, with unpkg fallback
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

export interface PDFParseResult extends ParseResult {
  numPages: number;
  pdfFileName?: string;
  generatedCsvContent: string;
}

/**
 * Extracts text from PDF document preserving reading order by grouping lines based on Y-coordinates.
 */
export async function extractTextFromPDF(data: ArrayBuffer | Uint8Array): Promise<{ fullText: string; lines: string[]; numPages: number }> {
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group items by Y coordinate (PDF Y coordinates go bottom-to-top)
    const items = textContent.items as Array<{ str: string; transform: number[] }>;
    const rowMap = new Map<number, Array<{ x: number; text: string }>>();

    for (const item of items) {
      if (!item.str || item.str.trim() === '') continue;
      const x = item.transform[4];
      const y = item.transform[5];

      // Find an existing row with similar Y coordinate (tolerance 4 points)
      let foundKey: number | null = null;
      for (const existingY of rowMap.keys()) {
        if (Math.abs(existingY - y) <= 4) {
          foundKey = existingY;
          break;
        }
      }

      const key = foundKey !== null ? foundKey : Math.round(y);
      if (!rowMap.has(key)) {
        rowMap.set(key, []);
      }
      rowMap.get(key)!.push({ x, text: item.str });
    }

    // Sort Y rows descending (top of page first)
    const sortedYs = Array.from(rowMap.keys()).sort((a, b) => b - a);

    for (const y of sortedYs) {
      const rowItems = rowMap.get(y)!;
      // Sort X ascending (left to right)
      rowItems.sort((a, b) => a.x - b.x);
      const line = rowItems.map((it) => it.text).join(' ').trim();
      if (line.length > 0) {
        allLines.push(line);
      }
    }
  }

  const fullText = allLines.join('\n');
  return { fullText, lines: allLines, numPages };
}

/**
 * Converts extracted PDF lines into standardized Aviator CSV:
 * Gráfico;Rodada;Data;Hora;Multiplicador
 */
export function convertPDFLinesToAviatorCSV(lines: string[]): string {
  const csvRows: string[] = ['Gráfico;Rodada;Data;Hora;Multiplicador'];
  const dateRegex = /(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})/;
  const timeRegex = /(\d{1,2}:\d{2}(?::\d{2})?)/;
  // Multiplier regex matching: 1.23x, 1,23x, 1.23, 1,23, 10x, etc.
  const multRegex = /\b(\d{1,4}(?:[.,]\d{1,2})?)\s*[xX]?\b/;

  let roundCounter = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line already has semicolons or commas
    if ((trimmed.includes(';') || trimmed.includes(',')) && trimmed.split(/[;,]/).length >= 3) {
      const parts = trimmed.split(/[;,]/).map((p) => p.trim());
      // Check if one part is a date/time and another is multiplier
      const datePart = parts.find((p) => dateRegex.test(p));
      const timePart = parts.find((p) => timeRegex.test(p));
      const multPart = parts.find((p) => /\d+[.,]\d+/.test(p) || p.toLowerCase().endsWith('x'));

      if (datePart && timePart && multPart) {
        const cleanedDate = (datePart.match(dateRegex)?.[1] || '').replace(/-/g, '/');
        const cleanedTime = timePart.match(timeRegex)?.[1] || '';
        const cleanedMult = (multPart.match(multRegex)?.[1] || multPart).replace('x', '').replace('X', '').replace(',', '.');
        if (parseFloat(cleanedMult) > 0) {
          csvRows.push(`1;R-${roundCounter++};${cleanedDate};${cleanedTime};${cleanedMult}x`);
          continue;
        }
      }
    }

    // Space-delimited line scanning
    const dateMatch = trimmed.match(dateRegex);
    const timeMatch = trimmed.match(timeRegex);

    if (dateMatch && timeMatch) {
      const dateStr = dateMatch[1].replace(/-/g, '/');
      const timeStr = timeMatch[1];

      // Remove date and time from the line to find multiplier and optional round
      let remaining = trimmed.replace(dateMatch[0], '').replace(timeMatch[0], '').trim();

      // Find multiplier in remaining text
      const tokens = remaining.split(/\s+/).filter(Boolean);
      let foundMult: string | null = null;
      let foundRound = `R-${roundCounter++}`;

      for (let i = tokens.length - 1; i >= 0; i--) {
        const tok = tokens[i];
        const m = tok.match(multRegex);
        if (m) {
          const val = parseFloat(m[1].replace(',', '.'));
          if (!isNaN(val) && val >= 1.0) {
            foundMult = m[1].replace(',', '.');
            // Check if there is a round ID token before or after
            const otherTokens = tokens.filter((_, idx) => idx !== i);
            const roundTok = otherTokens.find((t) => /^\d{4,}$/.test(t) || t.startsWith('#') || t.toLowerCase().startsWith('r-'));
            if (roundTok) {
              foundRound = roundTok.replace('#', '');
            }
            break;
          }
        }
      }

      if (foundMult) {
        csvRows.push(`1;${foundRound};${dateStr};${timeStr};${foundMult}x`);
      }
    }
  }

  return csvRows.join('\n');
}

/**
 * Parses an Aviator PDF file (ArrayBuffer or Uint8Array) into candles and generates CSV.
 */
export async function parseAviatorPDF(data: ArrayBuffer | Uint8Array, fileName = 'relatorio.pdf'): Promise<PDFParseResult> {
  try {
    const { lines, numPages, fullText } = await extractTextFromPDF(data);

    // 1. Try parsing extracted lines to standardized CSV
    const generatedCsvContent = convertPDFLinesToAviatorCSV(lines);

    // 2. Parse the generated CSV into standard AviatorCandles
    const parsed = parseAviatorCSV(generatedCsvContent);

    // If no candles found from line parser, try full text directly with standard CSV parser as fallback
    if (parsed.candles.length === 0) {
      const fallbackParsed = parseAviatorCSV(fullText);
      if (fallbackParsed.candles.length > 0) {
        return {
          ...fallbackParsed,
          numPages,
          pdfFileName: fileName,
          generatedCsvContent: fallbackParsed.rawText || fullText,
        };
      }
    }

    return {
      ...parsed,
      numPages,
      pdfFileName: fileName,
      generatedCsvContent,
    };
  } catch (err: any) {
    return {
      candles: [],
      errors: [`Erro ao processar PDF: ${err?.message || 'Arquivo protegido por senha ou formato incompatível.'}`],
      totalLines: 0,
      numPages: 0,
      generatedCsvContent: '',
      pdfFileName: fileName,
    };
  }
}

/**
 * Exports any collection of AviatorCandle objects to standard CSV string.
 */
export function exportCandlesToCSV(candles: AviatorCandle[]): string {
  const lines = ['Gráfico;Rodada;Data;Hora;Multiplicador'];
  for (const c of candles) {
    const multStr = c.multiplier.toFixed(2).replace('.', ',');
    lines.push(`${c.graphicId || '1'};${c.roundId};${c.date};${c.time};${multStr}x`);
  }
  return lines.join('\n');
}

/**
 * Triggers a browser file download for CSV content.
 */
export function downloadCSVFile(content: string, filename = 'historico_aviator.csv') {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
