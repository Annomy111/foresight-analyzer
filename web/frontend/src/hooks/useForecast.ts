import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { forecastApi } from '../lib/api';
import type { ForecastRequest, UkraineForecastRequest, JobStatus } from '../lib/api';

// Hook for creating custom forecast
export const useCreateCustomForecast = () => {
  return useMutation({
    mutationFn: (request: ForecastRequest) => forecastApi.createCustomForecast(request),
  });
};

// Hook for creating Ukraine forecast
export const useCreateUkraineForecast = () => {
  return useMutation({
    mutationFn: (request: UkraineForecastRequest) => forecastApi.createUkraineForecast(request),
  });
};

// Hook for job status with polling
export const useJobStatus = (jobId: string | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => forecastApi.getJobStatus(jobId!),
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling if job is completed or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      // Poll every 2 seconds while running
      return 2000;
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always consider stale to ensure refetch
    refetchOnMount: true, // Fetch immediately when component mounts
    refetchOnReconnect: true,
  });
};

// Hook for real-time WebSocket updates
export const useJobWebSocket = (jobId: string | null) => {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!jobId) return;

    const ws = forecastApi.connectWebSocket(jobId, (data) => {
      setStatus(data);
      // Update React Query cache
      queryClient.setQueryData(['job', jobId], data);
    });

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    return () => {
      ws.close();
    };
  }, [jobId, queryClient]);

  return { status, isConnected };
};

// Hook for listing all jobs
export const useJobs = () => {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: () => forecastApi.listJobs(),
  });
};

// Hook for available models
export const useModels = () => {
  return useQuery({
    queryKey: ['models'],
    queryFn: () => forecastApi.getModels(),
    staleTime: Infinity, // Models don't change often
  });
};

// Combined hook for forecast workflow
export const useForecastWorkflow = () => {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const createCustom = useCreateCustomForecast();
  const createUkraine = useCreateUkraineForecast();
  const { status: wsStatus, isConnected } = useJobWebSocket(currentJobId);
  const { data: polledStatus } = useJobStatus(currentJobId, !isConnected);

  // Use WebSocket data if connected, otherwise use polled data
  const status = isConnected ? wsStatus : polledStatus;

  const startCustomForecast = useCallback(async (request: ForecastRequest) => {
    const result = await createCustom.mutateAsync(request);
    setCurrentJobId(result.job_id);
    return result;
  }, [createCustom]);

  const startUkraineForecast = useCallback(async (request: UkraineForecastRequest) => {
    const result = await createUkraine.mutateAsync(request);
    setCurrentJobId(result.job_id);
    return result;
  }, [createUkraine]);

  const reset = useCallback(() => {
    setCurrentJobId(null);
  }, []);

  return {
    status,
    jobId: currentJobId,
    isConnected,
    startCustomForecast,
    startUkraineForecast,
    reset,
    isLoading: createCustom.isPending || createUkraine.isPending,
    error: createCustom.error || createUkraine.error,
  };
};
