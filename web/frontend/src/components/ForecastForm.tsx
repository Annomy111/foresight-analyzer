import { useState } from 'react';
import { useModels } from '../hooks/useForecast';
import { AlertCircle, Info, Sparkles } from 'lucide-react';
import type { ForecastRequest, UkraineForecastRequest } from '../lib/api';

interface ForecastFormProps {
  onSubmitCustom: (request: ForecastRequest) => void;
  onSubmitUkraine: (request: UkraineForecastRequest) => void;
  isLoading: boolean;
}

export const ForecastForm = ({ onSubmitCustom, onSubmitUkraine, isLoading }: ForecastFormProps) => {
  const [mode, setMode] = useState<'ukraine' | 'custom'>('ukraine');
  const [formData, setFormData] = useState({
    question: '',
    definition: '',
    timeframe: '',
    context: '',
    iterations: 10,
    apiKey: '',
    enhancedPrompts: false,
    selectedModels: [] as string[],
  });

  const { data: modelsData } = useModels();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'ukraine') {
      onSubmitUkraine({
        by_date: formData.timeframe || undefined,
        api_key: formData.apiKey || undefined,
        iterations: formData.iterations,
        enhanced_prompts: formData.enhancedPrompts,
      });
    } else {
      onSubmitCustom({
        question: formData.question,
        definition: formData.definition,
        timeframe: formData.timeframe || undefined,
        context: formData.context || undefined,
        models: formData.selectedModels.length > 0 ? formData.selectedModels : undefined,
        iterations: formData.iterations,
        api_key: formData.apiKey || undefined,
        enhanced_prompts: formData.enhancedPrompts,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mode Selection */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Forecast Type
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setMode('ukraine')}
            className={`p-4 rounded-lg border-2 transition-all ${
              mode === 'ukraine'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">Ukraine Ceasefire 2026</div>
            <div className="text-sm text-gray-500 mt-1">Research replication</div>
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`p-4 rounded-lg border-2 transition-all ${
              mode === 'custom'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">Custom Forecast</div>
            <div className="text-sm text-gray-500 mt-1">Your own question</div>
          </button>
        </div>
      </div>

      {/* Custom Forecast Fields */}
      {mode === 'custom' && (
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forecast Question *
            </label>
            <textarea
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              className="input-field h-24 resize-none"
              placeholder="Will there be a lasting peace agreement in the Middle East by 2030?"
              required={mode === 'custom'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Operational Definition *
            </label>
            <textarea
              value={formData.definition}
              onChange={(e) => setFormData({ ...formData, definition: e.target.value })}
              className="input-field h-32 resize-none"
              placeholder="Define exactly what constitutes success for this forecast..."
              required={mode === 'custom'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timeframe
              </label>
              <input
                type="text"
                value={formData.timeframe}
                onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                className="input-field"
                placeholder="2025-2030"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Iterations per Model
              </label>
              <input
                type="number"
                value={formData.iterations}
                onChange={(e) => setFormData({ ...formData, iterations: parseInt(e.target.value) })}
                className="input-field"
                min="1"
                max="50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Context
            </label>
            <textarea
              value={formData.context}
              onChange={(e) => setFormData({ ...formData, context: e.target.value })}
              className="input-field h-24 resize-none"
              placeholder="Any additional context or constraints for the models..."
            />
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className="card space-y-4">
        <h3 className="font-medium text-gray-900">Configuration</h3>

        {mode === 'ukraine' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Specific Date (Optional)
            </label>
            <input
              type="date"
              value={formData.timeframe}
              onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
              className="input-field"
            />
            <p className="text-xs text-gray-500 mt-1">
              Specify a date within 2026, e.g., Q1 (2026-03-31) or Q4 (2026-12-31)
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            OpenRouter API Key (Optional)
          </label>
          <input
            type="password"
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            className="input-field"
            placeholder="sk-or-v1-..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave empty to use server default. Get your key from{' '}
            <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              openrouter.ai
            </a>
          </p>
        </div>

        {modelsData && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Models (Optional)
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-500 mb-2">Free Models</div>
              {modelsData.free_models.map((model) => (
                <label key={model} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.selectedModels.includes(model)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, selectedModels: [...formData.selectedModels, model] });
                      } else {
                        setFormData({ ...formData, selectedModels: formData.selectedModels.filter(m => m !== model) });
                      }
                    }}
                    className="rounded text-primary-600"
                  />
                  <span className="text-sm">{model}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to use all configured models
            </p>
          </div>
        )}

        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="enhanced"
            checked={formData.enhancedPrompts}
            onChange={(e) => setFormData({ ...formData, enhancedPrompts: e.target.checked })}
            className="mt-1 rounded text-primary-600"
          />
          <label htmlFor="enhanced" className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Enhanced Prompts</span>
              <Sparkles className="w-4 h-4 text-yellow-500" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Use ensemble-aware prompts with meta-reasoning (experimental, may improve accuracy)
            </p>
          </label>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">About this forecast</p>
          <p>
            Uses 12-step German Super-Forecaster methodology with base rate analysis across multiple LLMs.
            {mode === 'ukraine' && ' Research replicates Schoenegger et al. (2024).'}
          </p>
        </div>
      </div>

      {/* Warning for long processing */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-800">
          <p className="font-medium mb-1">Processing Time</p>
          <p>
            Forecasts typically take 5-10 minutes. You'll see real-time progress updates.
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || (mode === 'custom' && (!formData.question || !formData.definition))}
        className="w-full btn-primary py-3 text-lg"
      >
        {isLoading ? (
          <span className="flex items-center justify-center space-x-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Starting Forecast...</span>
          </span>
        ) : (
          `Start ${mode === 'ukraine' ? 'Ukraine' : 'Custom'} Forecast`
        )}
      </button>
    </form>
  );
};
