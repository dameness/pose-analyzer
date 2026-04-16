import mockAnalysisData from '../assets/mockAnalysisData.json';
import type { ExerciseType, StatusResponse, SubmitVideoResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export async function submitVideo(
  file: File,
  exercise: ExerciseType
): Promise<SubmitVideoResponse> {
  if (!BASE_URL) {
    return { job_id: 'mock-job-id', status: 'queued' };
  }

  const formData = new FormData();
  formData.append('video', file);
  formData.append('exercise', exercise);

  const response = await fetch(`${BASE_URL}/analyze`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail ?? `HTTP ${response.status}`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  return response.json() as Promise<SubmitVideoResponse>;
}

export function buildVideoUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export async function getStatus(jobId: string): Promise<StatusResponse> {
  if (!BASE_URL) {
    return mockAnalysisData as StatusResponse;
  }

  const response = await fetch(`${BASE_URL}/status/${jobId}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Erro ao consultar status: ${response.status}`);
  }

  return response.json() as Promise<StatusResponse>;
}
