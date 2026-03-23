import { useState, useRef, useEffect } from 'react';
import type { AnalysisState, ExerciseType } from '../types';
import { submitVideo, getStatus } from '../services/api';

const INITIAL_STATE: AnalysisState = {
  phase: 'idle',
  jobId: null,
  result: null,
  error: null,
};

export function useAnalysis(): {
  state: AnalysisState;
  submit: (file: File, exercise: ExerciseType) => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = useState<AnalysisState>(INITIAL_STATE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPolling = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  async function submit(file: File, exercise: ExerciseType): Promise<void> {
    clearPolling();
    setState({ phase: 'uploading', jobId: null, result: null, error: null });

    let job_id: string;
    try {
      const response = await submitVideo(file, exercise);
      job_id = response.job_id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setState({ phase: 'error', jobId: null, result: null, error: message });
      return;
    }

    setState({ phase: 'polling', jobId: job_id, result: null, error: null });

    intervalRef.current = setInterval(async () => {
      try {
        const status = await getStatus(job_id);
        if (status.status === 'done') {
          clearPolling();
          setState({ phase: 'done', jobId: job_id, result: status.result, error: null });
        } else if (status.status === 'error') {
          clearPolling();
          setState({ phase: 'error', jobId: job_id, result: null, error: status.message });
        }
      } catch (err) {
        clearPolling();
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        setState({ phase: 'error', jobId: job_id, result: null, error: message });
      }
    }, 2000);
  }

  function reset(): void {
    clearPolling();
    setState(INITIAL_STATE);
  }

  useEffect(() => {
    return () => clearPolling();
  }, []);

  return { state, submit, reset };
}
