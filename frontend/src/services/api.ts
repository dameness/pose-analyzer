import type { ExerciseType, StatusResponse, SubmitVideoResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function submitVideo(
  file: File,
  exercise: ExerciseType
): Promise<SubmitVideoResponse> {
  if (!BASE_URL) {
    await delay(3000);
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
    await delay(3000);
    const mockResult: StatusResponse = {
      status: 'done',
      result: {
        exercise: 'squat',
        result: 'incorrect',
        confidence: 0.87,
        frames_analyzed: 42,
        joint_angles: {
          knee: [120, 118, 95, 88],
          hip: [170, 165, 140, 130],
          ankle: [90, 88, 85, 84],
        },
        joint_results: { knee: 'incorrect', hip: 'correct', ankle: 'correct' },
        errors: ['joelho passando a ponta do pé'],
      },
    };
    return mockResult;
  }

  const response = await fetch(`${BASE_URL}/status/${jobId}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Erro ao consultar status: ${response.status}`);
  }

  return response.json() as Promise<StatusResponse>;
}
