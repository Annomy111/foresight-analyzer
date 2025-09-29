import type { JobStatus } from '../lib/api';
import { Download, TrendingUp, Target, BarChart3, CheckCircle } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface ResultsDisplayProps {
  status: JobStatus;
}

export const ResultsDisplay = ({ status }: ResultsDisplayProps) => {
  if (!status.result) return null;

  const { result } = status;
  const ensembleProb = Math.round(result.ensemble_probability * 100);

  // Data for probability distribution chart
  const distributionData = {
    labels: ['Very Low (0-20%)', 'Low (20-40%)', 'Medium (40-60%)', 'High (60-80%)', 'Very High (80-100%)'],
    datasets: [
      {
        label: 'Probability Range',
        data: [
          result.statistics.min <= 0.2 ? 1 : 0,
          result.statistics.min <= 0.4 && result.statistics.max >= 0.2 ? 1 : 0,
          result.statistics.min <= 0.6 && result.statistics.max >= 0.4 ? 1 : 0,
          result.statistics.min <= 0.8 && result.statistics.max >= 0.6 ? 1 : 0,
          result.statistics.max >= 0.8 ? 1 : 0,
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.5)',
          'rgba(249, 115, 22, 0.5)',
          'rgba(234, 179, 8, 0.5)',
          'rgba(34, 197, 94, 0.5)',
          'rgba(59, 130, 246, 0.5)',
        ],
        borderColor: [
          'rgb(239, 68, 68)',
          'rgb(249, 115, 22)',
          'rgb(234, 179, 8)',
          'rgb(34, 197, 94)',
          'rgb(59, 130, 246)',
        ],
        borderWidth: 2,
      },
    ],
  };

  // Success vs Failed queries
  const successData = {
    labels: ['Successful', 'Failed'],
    datasets: [
      {
        data: [result.successful_queries, result.total_queries - result.successful_queries],
        backgroundColor: ['rgba(34, 197, 94, 0.5)', 'rgba(239, 68, 68, 0.5)'],
        borderColor: ['rgb(34, 197, 94)', 'rgb(239, 68, 68)'],
        borderWidth: 2,
      },
    ],
  };

  const getProbabilityColor = (prob: number) => {
    if (prob < 20) return 'text-red-600 bg-red-50';
    if (prob < 40) return 'text-orange-600 bg-orange-50';
    if (prob < 60) return 'text-yellow-600 bg-yellow-50';
    if (prob < 80) return 'text-green-600 bg-green-50';
    return 'text-blue-600 bg-blue-50';
  };

  const getProbabilityLabel = (prob: number) => {
    if (prob < 20) return 'Very Unlikely';
    if (prob < 40) return 'Unlikely';
    if (prob < 60) return 'Possible';
    if (prob < 80) return 'Likely';
    return 'Very Likely';
  };

  return (
    <div className="space-y-6">
      {/* Main Result Card */}
      <div className="card bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <Target className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-lg font-medium text-gray-700 mb-2">Ensemble Forecast</h2>
          <div className={`inline-block px-6 py-3 rounded-xl ${getProbabilityColor(ensembleProb)} mb-2`}>
            <div className="text-5xl font-bold">{ensembleProb}%</div>
          </div>
          <div className="text-lg font-medium text-gray-700 mt-2">
            {getProbabilityLabel(ensembleProb)}
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Based on {result.successful_queries} successful queries across {result.models_used.length} AI models
          </p>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Mean Probability"
          value={`${Math.round(result.statistics.mean * 100)}%`}
          color="blue"
        />
        <StatCard
          icon={BarChart3}
          label="Median"
          value={`${Math.round(result.statistics.median * 100)}%`}
          color="green"
        />
        <StatCard
          icon={Target}
          label="Std Deviation"
          value={`±${Math.round(result.statistics.std * 100)}%`}
          color="yellow"
        />
        <StatCard
          icon={CheckCircle}
          label="Success Rate"
          value={`${Math.round((result.successful_queries / result.total_queries) * 100)}%`}
          color="purple"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Probability Distribution */}
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-4">Probability Range</h3>
          <Bar
            data={distributionData}
            options={{
              responsive: true,
              plugins: {
                legend: {
                  display: false,
                },
                title: {
                  display: false,
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    stepSize: 1,
                  },
                },
              },
            }}
          />
          <div className="mt-4 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Min: {Math.round(result.statistics.min * 100)}%</span>
              <span>Max: {Math.round(result.statistics.max * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Success Rate Donut */}
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-4">Query Success Rate</h3>
          <div className="max-w-xs mx-auto">
            <Doughnut
              data={successData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'bottom',
                  },
                },
              }}
            />
          </div>
          <div className="mt-4 text-center text-sm text-gray-600">
            {result.successful_queries} of {result.total_queries} queries successful
          </div>
        </div>
      </div>

      {/* Models Used */}
      <div className="card">
        <h3 className="font-medium text-gray-900 mb-4">Models Used ({result.models_used.length})</h3>
        <div className="flex flex-wrap gap-2">
          {result.models_used.map((model) => (
            <span
              key={model}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
            >
              {model}
            </span>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div className="card bg-gray-50">
        <h3 className="font-medium text-gray-900 mb-4">Forecast Metadata</h3>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Total Duration</dt>
            <dd className="text-gray-900 font-medium mt-1">
              {Math.round(result.duration / 60)} minutes {result.duration % 60} seconds
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Completed At</dt>
            <dd className="text-gray-900 font-medium mt-1">
              {new Date(status.updated_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Job ID</dt>
            <dd className="text-gray-900 font-medium mt-1 font-mono text-xs">
              {status.job_id}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className="text-green-600 font-medium mt-1 capitalize">
              {status.status}
            </dd>
          </div>
        </dl>
      </div>

      {/* Download Button */}
      <button className="w-full btn-primary py-3 flex items-center justify-center space-x-2">
        <Download className="w-5 h-5" />
        <span>Download Full Report (Excel)</span>
      </button>
    </div>
  );
};

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}

const StatCard = ({ icon: Icon, label, value, color }: StatCardProps) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="card">
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-sm text-gray-500">{label}</div>
          <div className="text-xl font-bold text-gray-900">{value}</div>
        </div>
      </div>
    </div>
  );
};
