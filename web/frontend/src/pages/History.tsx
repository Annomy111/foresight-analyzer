import { useState, useEffect } from 'react';
import { forecastApi } from '../lib/api';
import type { JobStatus } from '../lib/api';
import { Clock, TrendingUp, CheckCircle2, XCircle, Trash2, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const History = () => {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadHistory();
    loadStatistics();
  }, [statusFilter, searchTerm]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const params = {
        limit: 50,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchTerm || undefined,
      };
      const response = await forecastApi.getHistory(params);
      // API returns { jobs: [...], total: ..., limit: ..., offset: ... }
      setJobs(response.jobs || response);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const data = await forecastApi.getStatistics();
      setStats(data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Möchten Sie diesen Forecast wirklich löschen?')) return;

    try {
      await forecastApi.deleteJob(jobId);
      loadHistory();
      loadStatistics();
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('Fehler beim Löschen');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'running': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5" />;
      case 'failed': return <XCircle className="w-5 h-5" />;
      case 'running': return <Clock className="w-5 h-5 animate-spin" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Forecast History</h1>
        <p className="text-gray-600">Alle durchgeführten Forecasts und deren Ergebnisse</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Total Forecasts</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_jobs}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Success Rate</div>
            <div className="text-2xl font-bold text-green-600">{stats.success_rate?.toFixed(1)}%</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Avg. Probability</div>
            <div className="text-2xl font-bold text-primary-600">{(stats.average_probability * 100)?.toFixed(1)}%</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Total Queries</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_queries}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Suche nach Frage..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {['all', 'completed', 'running', 'failed'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === filter
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter === 'all' ? 'Alle' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="card text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-gray-600">Lade History...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">Keine Forecasts gefunden</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.job_id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                      {getStatusIcon(job.status)}
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                    </span>
                    {job.duration_seconds && (
                      <span className="text-sm text-gray-500">
                        • {Math.round(job.duration_seconds / 60)}m {Math.round(job.duration_seconds % 60)}s
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{job.question}</h3>
                  {job.result && (
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary-600" />
                        <span className="font-medium text-primary-600">
                          {(job.result.ensemble_probability * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-gray-600">
                        {job.result.successful_queries}/{job.result.total_queries} Queries
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(job.job_id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Löschen"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
