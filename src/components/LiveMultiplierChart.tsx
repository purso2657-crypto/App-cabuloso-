import React, { useState, useMemo } from 'react';
import { AviatorCandle } from '../types';
import { Flame, TrendingUp, Sparkles, Activity, Layers, BarChart2 } from 'lucide-react';

interface LiveMultiplierChartProps {
  candles: AviatorCandle[];
  title: string;
  badge: string;
  accentColor?: string;
  compact?: boolean;
}

export const LiveMultiplierChart: React.FC<LiveMultiplierChartProps> = ({
  candles,
  title,
  badge,
  accentColor = '#a855f7',
  compact = false,
}) => {
  const [viewCount, setViewCount] = useState<number>(compact ? 25 : 40);
  const [hoveredCandle, setHoveredCandle] = useState<AviatorCandle | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);

  // Take the most recent candles according to selected viewCount
  const displayedCandles = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    return candles.slice(-viewCount);
  }, [candles, viewCount]);

  // Statistics for the displayed set
  const stats = useMemo(() => {
    if (displayedCandles.length === 0) {
      return {
        total: 0,
        blues: 0,
        purples: 0,
        pinks: 0,
        golds: 0,
        bluePct: 0,
        purplePct: 0,
        pinkPct: 0,
        max: 0,
        avg: 0,
      };
    }

    let blues = 0;
    let purples = 0;
    let pinks = 0;
    let golds = 0;
    let max = 0;
    let sum = 0;

    for (const c of displayedCandles) {
      const m = c.multiplier;
      sum += m;
      if (m > max) max = m;
      if (m >= 50.0) {
        golds++;
        pinks++;
      } else if (m >= 10.0) {
        pinks++;
      } else if (m >= 2.0) {
        purples++;
      } else {
        blues++;
      }
    }

    const total = displayedCandles.length;
    return {
      total,
      blues,
      purples,
      pinks,
      golds,
      bluePct: Math.round((blues / total) * 100),
      purplePct: Math.round((purples / total) * 100),
      pinkPct: Math.round((pinks / total) * 100),
      max,
      avg: Number((sum / total).toFixed(2)),
    };
  }, [displayedCandles]);

  // Height formula: smooth logarithmic mapping between 12% and 95%
  const getBarHeightPercent = (mult: number) => {
    if (mult <= 1.0) return 10;
    if (mult < 2.0) {
      // 1.0 -> 10%, 1.99 -> 26%
      return 10 + ((mult - 1.0) / 0.99) * 16;
    }
    if (mult < 10.0) {
      // 2.0 -> 28%, 9.99 -> 60%
      return 28 + ((mult - 2.0) / 8.0) * 32;
    }
    if (mult < 50.0) {
      // 10.0 -> 62%, 49.99 -> 84%
      return 62 + ((mult - 10.0) / 40.0) * 22;
    }
    // 50+ -> 85% to 96%
    const extra = Math.min(12, Math.log10(mult / 50) * 8);
    return Math.min(96, 85 + extra);
  };

  const getBarColor = (mult: number) => {
    if (mult >= 50.0) {
      return {
        bg: 'bg-gradient-to-t from-amber-600 via-amber-400 to-yellow-200',
        border: 'border-yellow-200',
        glow: 'shadow-[0_0_12px_rgba(251,191,36,0.8)]',
        textColor: 'text-amber-200',
        badge: 'SUPER 50X+ 👑',
      };
    }
    if (mult >= 10.0) {
      return {
        bg: 'bg-gradient-to-t from-pink-800 via-pink-600 to-rose-400',
        border: 'border-pink-400',
        glow: 'shadow-[0_0_10px_rgba(244,63,94,0.6)]',
        textColor: 'text-pink-300',
        badge: 'ROSA 10X+ 🌹',
      };
    }
    if (mult >= 2.0) {
      return {
        bg: 'bg-gradient-to-t from-purple-800 via-purple-600 to-indigo-400',
        border: 'border-purple-400',
        glow: '',
        textColor: 'text-purple-300',
        badge: 'ROXA 2X-9X 💜',
      };
    }
    return {
      bg: 'bg-gradient-to-t from-blue-900 via-blue-700 to-cyan-400',
      border: 'border-blue-400',
      glow: '',
      textColor: 'text-cyan-300',
      badge: 'AZUL < 2X ❄️',
    };
  };

  return (
    <div className="bg-[#0b081a] border border-purple-900/40 rounded-3xl p-4 sm:p-5 shadow-2xl relative flex flex-col justify-between">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-900/30">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shadow-md"
            style={{ backgroundColor: `${accentColor}25`, color: accentColor, border: `1px solid ${accentColor}60` }}
          >
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-extrabold text-white">{title}</h4>
              <span
                className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{ backgroundColor: `${accentColor}30`, color: accentColor, border: `1px solid ${accentColor}70` }}
              >
                {badge}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
              Gráfico de dispersão de multiplicadores em tempo real
            </p>
          </div>
        </div>

        {/* View Range Buttons */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {[20, 35, 50, 100].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setViewCount(count)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                viewCount === count
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-purple-900/40'
              }`}
            >
              {count} velas
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart Canvas Area */}
      <div className="relative mt-4 mb-2 h-56 sm:h-64 w-full bg-[#080514]/90 rounded-2xl border border-purple-950/80 p-3 sm:p-4 flex flex-col justify-end overflow-hidden select-none">
        {/* Background Grid Lines & Reference Thresholds */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 opacity-30">
          <div className="border-b border-dashed border-amber-400/40 w-full flex justify-between items-center text-[9px] font-mono text-amber-300">
            <span>50.00x (Super Rosa)</span>
          </div>
          <div className="border-b border-dashed border-pink-500/50 w-full flex justify-between items-center text-[9px] font-mono text-pink-400">
            <span>10.00x (Meta Rosa VIP)</span>
          </div>
          <div className="border-b border-dashed border-purple-400/50 w-full flex justify-between items-center text-[9px] font-mono text-purple-300">
            <span>2.00x (Meta Proteção)</span>
          </div>
          <div className="border-b border-slate-700/50 w-full flex justify-between items-center text-[9px] font-mono text-slate-500">
            <span>1.00x (Crash Mínimo)</span>
          </div>
        </div>

        {/* Bars Container */}
        <div className="relative z-10 w-full h-full flex items-end justify-between gap-1 sm:gap-1.5 pt-4">
          {displayedCandles.length > 0 ? (
            displayedCandles.map((c, idx) => {
              const heightPct = getBarHeightPercent(c.multiplier);
              const colorInfo = getBarColor(c.multiplier);
              const isHovered = hoveredCandle?.id === c.id;

              return (
                <div
                  key={`${c.id}-${idx}`}
                  className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                  onMouseEnter={(e) => {
                    setHoveredCandle(c);
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoverPosition({ x: rect.left, y: rect.top });
                  }}
                  onMouseLeave={() => setHoveredCandle(null)}
                >
                  {/* Candle Bar */}
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full max-w-[18px] rounded-t-md transition-all duration-300 border-t ${
                      colorInfo.bg
                    } ${colorInfo.border} ${colorInfo.glow} ${
                      isHovered ? 'scale-110 brightness-125 z-20' : 'opacity-90 group-hover:opacity-100'
                    }`}
                  />

                  {/* Micro label on bottom if pink/gold or last candle */}
                  {(c.multiplier >= 10.0 || idx === displayedCandles.length - 1) && (
                    <span
                      className={`text-[8px] font-mono font-bold mt-1 truncate max-w-full hidden sm:block ${
                        c.multiplier >= 10.0 ? 'text-pink-300 font-black' : 'text-slate-400'
                      }`}
                    >
                      {c.multiplier.toFixed(1)}x
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 font-mono">
              Aguardando histórico do feed ao vivo...
            </div>
          )}
        </div>

        {/* Floating Tooltip when hovering over a candle */}
        {hoveredCandle && (
          <div className="absolute top-3 right-3 z-30 bg-[#160f2e]/95 border border-purple-500/70 p-3 rounded-2xl shadow-2xl backdrop-blur-md pointer-events-none animate-fadeIn flex items-center gap-3">
            <div
              className={`text-2xl font-black px-2.5 py-1 rounded-xl border ${
                getBarColor(hoveredCandle.multiplier).bg
              } ${getBarColor(hoveredCandle.multiplier).textColor}`}
            >
              {hoveredCandle.multiplier.toFixed(2)}x
            </div>
            <div className="text-[11px] font-mono space-y-0.5">
              <div className="font-bold text-white">Rodada #{hoveredCandle.roundId}</div>
              <div className="text-slate-300">Horário: {hoveredCandle.time}</div>
              <div className="text-pink-400 font-black">
                {getBarColor(hoveredCandle.multiplier).badge}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Summary Strip for the Chart */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t border-purple-900/30 text-center">
        <div className="bg-[#120d26] p-2 rounded-xl border border-purple-900/30">
          <span className="text-[9px] text-slate-400 block uppercase font-mono">Total Velas</span>
          <span className="text-xs sm:text-sm font-black font-mono text-white">{stats.total}</span>
        </div>

        <div className="bg-[#120d26] p-2 rounded-xl border border-purple-900/30">
          <span className="text-[9px] text-cyan-400 block uppercase font-mono">Azuis (&lt; 2x)</span>
          <span className="text-xs sm:text-sm font-black font-mono text-cyan-300">
            {stats.blues} ({stats.bluePct}%)
          </span>
        </div>

        <div className="bg-[#120d26] p-2 rounded-xl border border-purple-900/30">
          <span className="text-[9px] text-purple-300 block uppercase font-mono">Roxas (2x-9x)</span>
          <span className="text-xs sm:text-sm font-black font-mono text-purple-300">
            {stats.purples} ({stats.purplePct}%)
          </span>
        </div>

        <div className="bg-[#120d26] p-2 rounded-xl border border-purple-900/30">
          <span className="text-[9px] text-pink-400 block uppercase font-mono">Rosas (10x+)</span>
          <span className="text-xs sm:text-sm font-black font-mono text-pink-300">
            {stats.pinks} ({stats.pinkPct}%)
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-[#120d26] p-2 rounded-xl border border-purple-900/30">
          <span className="text-[9px] text-amber-400 block uppercase font-mono">Máxima Pico</span>
          <span className="text-xs sm:text-sm font-black font-mono text-amber-300">
            {stats.max > 0 ? `${stats.max.toFixed(2)}x` : '--'}
          </span>
        </div>
      </div>
    </div>
  );
};
