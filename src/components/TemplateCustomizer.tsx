import React from 'react';
import { TelegramTemplateConfig } from '../types';
import { Sliders, X, RotateCcw, Check, Sparkles } from 'lucide-react';
import { DEFAULT_TELEGRAM_CONFIG } from '../utils/correctionEngine';

interface TemplateCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  config: TelegramTemplateConfig;
  onSaveConfig: (newConfig: TelegramTemplateConfig) => void;
}

export const TemplateCustomizer: React.FC<TemplateCustomizerProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [localConfig, setLocalConfig] = React.useState<TelegramTemplateConfig>(config);

  React.useEffect(() => {
    setLocalConfig(config);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleReset = () => {
    setLocalConfig(DEFAULT_TELEGRAM_CONFIG);
  };

  const handleSave = () => {
    onSaveConfig(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#120f21] border border-purple-800/80 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl shadow-purple-950/80 text-slate-100">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-purple-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-900/50 text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Personalizar Mensagem Telegram
              </h3>
              <p className="text-xs text-purple-300/70">
                Ajuste os links, regras ou tamanho da janela de velas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Header Title */}
          <div>
            <label className="block font-semibold text-purple-200 mb-1">
              Título Cabeçalho
            </label>
            <input
              type="text"
              value={localConfig.headerTitle}
              onChange={(e) =>
                setLocalConfig({ ...localConfig, headerTitle: e.target.value })
              }
              className="w-full bg-[#0a0814] border border-purple-900/60 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Broker Link */}
          <div>
            <label className="block font-semibold text-purple-200 mb-1">
              Link da Casa / Plataforma
            </label>
            <input
              type="text"
              value={localConfig.brokerLink}
              onChange={(e) =>
                setLocalConfig({ ...localConfig, brokerLink: e.target.value })
              }
              className="w-full bg-[#0a0814] border border-purple-900/60 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
            />
          </div>

          {/* Proteção & Objetivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-purple-200 mb-1">
                Linha de Proteção
              </label>
              <input
                type="text"
                value={localConfig.protecao}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, protecao: e.target.value })
                }
                className="w-full bg-[#0a0814] border border-purple-900/60 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block font-semibold text-purple-200 mb-1">
                Linha de Objetivo
              </label>
              <input
                type="text"
                value={localConfig.objetivo}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, objetivo: e.target.value })
                }
                className="w-full bg-[#0a0814] border border-purple-900/60 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Janela de Velas (default 6) */}
          <div className="bg-[#090714] p-3 rounded-xl border border-purple-900/50">
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Janela de Análise por Sinal
              </label>
              <span className="font-mono font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                {localConfig.candleWindow} Velas Consecutivas
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Padrão oficial Aviator VIP: <strong>6 velas</strong> (a do minuto do sinal + 5 seguintes).
            </p>
            <input
              type="range"
              min={1}
              max={12}
              value={localConfig.candleWindow}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  candleWindow: parseInt(e.target.value, 10) || 6,
                })
              }
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Gatilho & Máximo Tentativas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-purple-200 mb-1">
                Gatilho
              </label>
              <input
                type="text"
                value={localConfig.gatilho || '🟣 Gatilho: após ROXA'}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, gatilho: e.target.value })
                }
                className="w-full bg-[#0a0814] border border-purple-900/60 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block font-semibold text-purple-200 mb-1">
                Máximo Tentativas
              </label>
              <input
                type="text"
                value={localConfig.maxTentativas || '🔢 Máximo: 5 tentativas'}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, maxTentativas: e.target.value })
                }
                className="w-full bg-[#0a0814] border border-purple-900/60 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 mt-6 border-t border-purple-900/50">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-purple-950/40 hover:bg-purple-900/40 border border-purple-900/60 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Padrão
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 rounded-lg shadow-md transition-colors"
            >
              <Check className="w-4 h-4" />
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
