import { useState } from 'react';
import { ForecastForm } from '../components/ForecastForm';
import { ProgressDisplay } from '../components/ProgressDisplay';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { useForecastWorkflow } from '../hooks/useForecast';
import { ArrowLeft } from 'lucide-react';

export const Home = () => {
  const {
    status,
    jobId,
    isConnected,
    startCustomForecast,
    startUkraineForecast,
    reset,
    isLoading,
    error,
  } = useForecastWorkflow();

  const [showForm, setShowForm] = useState(true);

  const handleStartForecast = async (request: any, isUkraine: boolean) => {
    try {
      if (isUkraine) {
        await startUkraineForecast(request);
      } else {
        await startCustomForecast(request);
      }
      setShowForm(false);
    } catch (err) {
      console.error('Failed to start forecast:', err);
    }
  };

  const handleReset = () => {
    reset();
    setShowForm(true);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Create New Forecast
        </h1>
        <p className="text-gray-600">
          Generate probabilistic forecasts using ensemble AI models with Super-Forecaster methodology
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-medium text-red-900 mb-1">Error Starting Forecast</h3>
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
      )}

      {/* Content */}
      {showForm && !jobId ? (
        <ForecastForm
          onSubmitCustom={(req) => handleStartForecast(req, false)}
          onSubmitUkraine={(req) => handleStartForecast(req, true)}
          isLoading={isLoading}
        />
      ) : (
        <div className="space-y-6">
          {/* Back Button */}
          {status?.status === 'completed' || status?.status === 'failed' ? (
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Create New Forecast</span>
            </button>
          ) : null}

          {/* Progress or Results */}
          {status?.status === 'completed' && status.result ? (
            <ResultsDisplay status={status} />
          ) : status ? (
            <ProgressDisplay status={status} isConnected={isConnected} />
          ) : null}
        </div>
      )}
    </div>
  );
};
