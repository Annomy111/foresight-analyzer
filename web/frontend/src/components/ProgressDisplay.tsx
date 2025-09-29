import { JobStatus } from '../lib/api';
import { CheckCircle2, XCircle, Loader2, Wifi, WifiOff, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProgressDisplayProps {
  status: JobStatus | null;
  isConnected: boolean;
}

export const ProgressDisplay = ({ status, isConnected }: ProgressDisplayProps) => {
  if (!status) return null;

  const getStatusColor = () => {
    switch (status.status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'running':
        return 'text-primary-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case 'completed':
        return <CheckCircle2 className="w-8 h-8 text-green-600" />;
      case 'failed':
        return <XCircle className="w-8 h-8 text-red-600" />;
      case 'running':
      case 'pending':
        return <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />;
      default:
        return null;
    }
  };

  const progressPercent = Math.round(status.progress * 100);

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-600">Real-time updates active</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Polling for updates...</span>
            </>
          )}
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Started {formatDistanceToNow(new Date(status.created_at), { addSuffix: true })}</span>
        </div>
      </div>

      {/* Main Status Card */}
      <div className="card">
        <div className="flex items-center space-x-4 mb-6">
          {getStatusIcon()}
          <div className="flex-1">
            <h3 className={`text-2xl font-bold ${getStatusColor()}`}>
              {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
            </h3>
            <p className="text-gray-600 mt-1">{status.message}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">{progressPercent}%</div>
            <div className="text-sm text-gray-500">Progress</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-full transition-all duration-500 ease-out ${
              status.status === 'completed'
                ? 'bg-green-500'
                : status.status === 'failed'
                ? 'bg-red-500'
                : 'bg-primary-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
          {status.status === 'running' && (
            <div
              className="absolute left-0 top-0 h-full w-1/4 bg-white opacity-30 animate-pulse"
              style={{
                animation: 'shimmer 2s infinite',
              }}
            />
          )}
        </div>

        {/* Job ID */}
        <div className="mt-4 text-xs text-gray-500">
          Job ID: <code className="bg-gray-100 px-2 py-1 rounded">{status.job_id}</code>
        </div>
      </div>

      {/* Processing Steps Breakdown */}
      {status.status === 'running' && (
        <div className="card">
          <h4 className="font-medium text-gray-900 mb-4">Processing Steps</h4>
          <div className="space-y-3">
            <ProcessingStep
              label="Initializing models"
              isComplete={status.progress > 0.1}
              isCurrent={status.progress <= 0.1}
            />
            <ProcessingStep
              label="Querying LLMs"
              isComplete={status.progress > 0.6}
              isCurrent={status.progress > 0.1 && status.progress <= 0.6}
            />
            <ProcessingStep
              label="Processing responses"
              isComplete={status.progress > 0.8}
              isCurrent={status.progress > 0.6 && status.progress <= 0.8}
            />
            <ProcessingStep
              label="Generating report"
              isComplete={status.progress >= 1.0}
              isCurrent={status.progress > 0.8 && status.progress < 1.0}
            />
          </div>
        </div>
      )}

      {/* Error Details */}
      {status.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-900 mb-2">Error Details</h4>
          <p className="text-sm text-red-700">{status.message}</p>
        </div>
      )}
    </div>
  );
};

interface ProcessingStepProps {
  label: string;
  isComplete: boolean;
  isCurrent: boolean;
}

const ProcessingStep = ({ label, isComplete, isCurrent }: ProcessingStepProps) => {
  return (
    <div className="flex items-center space-x-3">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isComplete
            ? 'bg-green-100'
            : isCurrent
            ? 'bg-primary-100'
            : 'bg-gray-100'
        }`}
      >
        {isComplete ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : isCurrent ? (
          <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
        ) : (
          <div className="w-3 h-3 rounded-full bg-gray-300" />
        )}
      </div>
      <span
        className={`flex-1 ${
          isComplete || isCurrent ? 'text-gray-900 font-medium' : 'text-gray-500'
        }`}
      >
        {label}
      </span>
    </div>
  );
};

<style>{`
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
`}</style>
