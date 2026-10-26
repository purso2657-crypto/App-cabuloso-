import React from 'react';
import { CorrectionSummary } from '../types';
import { Award, TrendingUp, Zap, Target, Shield, XCircle, Sparkles, CheckCheck } from 'lucide-react';

interface SummaryCardsProps {
  summary: CorrectionSummary;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  const isHighSuccess = summary.greenRate >= 80;

  return (
    <div className="space-y-4">
      {/* Top Banner KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Assertividade Geral (Taxa Green) */}
        <div className="bg-gradient-to-br from-[#1b1435] to-[#120d24] border border-purple-700/50 rounded-2xl p-4 shadow-lg shadow-purple-950/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Taxa de Green (≥ 2.30x)
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
              Proteção Inclusa
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-emerald-400">
              {summary.greenRate.toFixed(1).replace('.', ',')}%
            </span>
            <span className="text-xs text-slate-400">
              ({summary.roses + summary.fires + summary.purples + summary.shields} de {summary.foundSignals})
            </span>
          </div>
          <div className="w-full bg-black/40 h-2 rounded-full mt-3 overflow-hidden border border-purple-900/50">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, summary.greenRate)}%` }}
            />
          </div>
        </div>

        {/* Assertividade Alvo VIP (>= 3.00x) */}
        <div className="bg-gradient-to-br from-[#1e1538] to-[#140e29] border border-amber-500/40 rounded-2xl p-4 shadow-lg shadow-amber-950/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-amber-400" />
              Alvo VIP Oficial (≥ 3.00x)
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-950 text-amber-300 border border-amber-700/50">
              Meta Principal
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-amber-400">
              {summary.vipTargetRate.toFixed(1).replace('.', ',')}%
            </span>
            <span className="text-xs text-slate-400">
              ({summary.roses + summary.fires + summary.purples} batidas)
            </span>
          </div>
          <div className="w-full bg-black/40 h-2 rounded-full mt-3 overflow-hidden border border-amber-950/60">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-amber-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, summary.vipTargetRate)}%` }}
            />
          </div>
        </div>

        {/* Maior Multiplicador e Média */}
        <div className="bg-gradient-to-br from-[#18112c] to-[#100b20] border border-purple-800/40 rounded-2xl p-4 shadow-lg shadow-black/40 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-pink-400" />
              Pico Máximo dos Sinais
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-pink-950 text-pink-300 border border-pink-800">
              Recorde
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-pink-400">
              {summary.highestMultiplier.toFixed(2).replace('.', ',')}x
            </span>
            <span className="text-xs text-pink-300/80">🌹</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Média por sinal: <strong className="text-slate-200 font-mono">{summary.averageMultiplier.toFixed(2).replace('.', ',')}x</strong>
          </p>
        </div>
      </div>

      {/* Category Breakdown Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {/* 🌹 Rosa >= 10x */}
        <div className="bg-[#170e24] border border-pink-500/40 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌹</span>
            <div>
              <span className="text-[11px] font-bold text-pink-300 block leading-tight">
                Rosas
              </span>
              <span className="text-[10px] text-pink-400/80 block font-mono">
                ≥ 10.00x
              </span>
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black font-mono text-pink-400">
            {summary.roses}
          </span>
        </div>

        {/* 🔥 Velas Altas 6x - 9.99x */}
        <div className="bg-[#1a1215] border border-amber-500/40 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <div>
              <span className="text-[11px] font-bold text-amber-300 block leading-tight">
                Velas Altas
              </span>
              <span className="text-[10px] text-amber-400/80 block font-mono">
                6.00x - 9.99x
              </span>
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black font-mono text-amber-400">
            {summary.fires}
          </span>
        </div>

        {/* 🟣 Roxas 3x - 5.99x */}
        <div className="bg-[#18112d] border border-purple-500/40 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🟣</span>
            <div>
              <span className="text-[11px] font-bold text-purple-300 block leading-tight">
                Roxas
              </span>
              <span className="text-[10px] text-purple-400/80 block font-mono">
                3.00x - 5.99x
              </span>
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black font-mono text-purple-300">
            {summary.purples}
          </span>
        </div>

        {/* 🛡 Proteção 2.30x - 2.99x */}
        <div className="bg-[#0f162c] border border-blue-500/40 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡</span>
            <div>
              <span className="text-[11px] font-bold text-blue-300 block leading-tight">
                Proteção
              </span>
              <span className="text-[10px] text-blue-400/80 block font-mono">
                2.30x - 2.99x
              </span>
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black font-mono text-blue-400">
            {summary.shields}
          </span>
        </div>

        {/* ❌ Reds < 2.30x */}
        <div className="bg-[#220d14] border border-rose-600/40 rounded-xl p-3 flex items-center justify-between shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">❌</span>
            <div>
              <span className="text-[11px] font-bold text-rose-300 block leading-tight">
                Reds
              </span>
              <span className="text-[10px] text-rose-400/80 block font-mono">
                &lt; 2.30x
              </span>
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black font-mono text-rose-400">
            {summary.reds}
          </span>
        </div>
      </div>

      {summary.notFound > 0 && (
        <div className="p-3 bg-amber-950/30 border border-amber-700/40 rounded-xl flex items-center justify-between text-xs text-amber-200">
          <span>
            ⚠️ <strong>{summary.notFound}</strong> {summary.notFound === 1 ? 'horário de sinal não foi localizado' : 'horários de sinal não foram localizados'} dentro do intervalo deste arquivo CSV.
          </span>
        </div>
      )}
    </div>
  );
};
