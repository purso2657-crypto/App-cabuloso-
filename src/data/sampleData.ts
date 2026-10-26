/**
 * Sample realistic Aviator data and signals for quick testing and demonstration.
 */

export const SAMPLE_SIGNALS_TEXT = `19:07
19:12
19:17
19:19
19:26
19:31
19:37
19:40
19:48
19:49
19:57
20:00
20:02
20:04
20:11
20:15
20:18
20:19
20:33
20:34
20:39
20:52
20:54
20:58
21:07
21:10
21:11
21:17
21:25
21:26
21:31
21:37`;

export function generateSampleAviatorCSV(): string {
  const rows: string[] = ['Gráfico;Rodada;Data;Hora;Multiplicador'];
  const today = new Date();

  // Generate 3 days of historical Aviator data for robust multi-day testing
  const daysToGenerate = [
    new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), // Day 1 (2 days ago)
    new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // Day 2 (yesterday)
    today, // Day 3 (today)
  ];

  // Realistic seed multipliers distribution with various pink candles (>10x)
  const realisticMults = [
    5.90, 1.05, 3.45, 1.82, 20.28, 1.45, 2.90, 4.12, 5.67, 7.82,
    1.24, 2.58, 1.15, 1.76, 11.04, 1.08, 3.90, 6.02, 1.32, 6.65,
    2.42, 1.02, 6.39, 1.44, 4.69, 1.11, 5.01, 2.33, 4.20, 9.08,
    5.09, 18.84, 6.12, 5.57, 3.00, 13.50, 20.04, 14.51, 21.58, 6.02,
    24.61, 5.53, 3.44, 3.76, 1.17, 9.40, 1.34, 4.95, 1.09, 2.95,
    1.60, 22.10, 1.25, 3.75, 1.40, 1.80, 7.20, 1.04, 2.35, 1.52,
    1.18, 4.60, 1.29, 6.30, 1.45, 12.05, 1.10, 2.80, 3.50, 1.70,
    1.14, 15.70, 1.03, 2.40, 4.20, 1.30, 28.50, 1.07, 3.10, 1.90,
  ];

  let roundNum = 884100;
  let mIdx = 0;

  for (const day of daysToGenerate) {
    const dd = String(day.getDate()).padStart(2, '0');
    const mm = String(day.getMonth() + 1).padStart(2, '0');
    const yyyy = day.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;

    let currentSecond = 14 * 3600; // 14:00:00 to 22:00:00
    while (currentSecond <= 22 * 3600) {
      const hh = String(Math.floor(currentSecond / 3600)).padStart(2, '0');
      const mmVal = String(Math.floor((currentSecond % 3600) / 60)).padStart(2, '0');
      const ss = String(currentSecond % 60).padStart(2, '0');
      const timeStr = `${hh}:${mmVal}:${ss}`;

      const mult = realisticMults[mIdx % realisticMults.length];
      mIdx++;

      const multFormatted = mult.toFixed(2).replace('.', ',');
      rows.push(`1;${roundNum};${dateStr};${timeStr};${multFormatted}`);

      roundNum++;
      const duration = Math.floor(18 + Math.random() * 14);
      currentSecond += duration;
    }
  }

  return rows.join('\n');
}
