export type ExerciseType = 'squat' | 'situp' | 'pushup';

export interface ExerciseOption {
  value: ExerciseType;
  label: string;
}

export interface SubmitVideoResponse {
  job_id: string;
  status: 'queued';
}

export type JointAngles = Record<string, number[]>;

export interface AnalysisResult {
  exercise: ExerciseType;
  result: 'correct' | 'incorrect';
  confidence: number;
  frames_analyzed: number;
  joint_angles: JointAngles;
  joint_results: Record<string, 'correct' | 'incorrect'>;
  errors: string[];
  video_url?: string;
}

export type StatusResponse =
  | { status: 'processing' }
  | { status: 'done'; result: AnalysisResult }
  | { status: 'error'; error_type: 'validation_error' | 'invalid_file' | 'processing_error'; message: string };

export type AnalysisPhase = 'idle' | 'uploading' | 'polling' | 'done' | 'error';

export interface AnalysisState {
  phase: AnalysisPhase;
  jobId: string | null;
  result: AnalysisResult | null;
  error: string | null;
}

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

export interface VideoRecorderState {
  status: RecordingStatus;
  videoBlob: Blob | null;
  videoUrl: string | null;
  error: string | null;
}

export interface ExerciseSelectorProps {
  selected: ExerciseType | null;
  onSelect: (exercise: ExerciseType) => void;
}

export interface VideoInputProps {
  recorder: import('../hooks/useVideoRecorder').UseVideoRecorderReturn;
  onVideoReady: (file: File) => void;
  disabled?: boolean;
}

export interface AnalysisStatusProps {
  phase: AnalysisPhase;
}

export interface AnalysisResultProps {
  result: AnalysisResult;
  onReset: () => void;
}

export interface JointFeedbackProps {
  joint: string;
  correct: boolean;
}

export interface AngleChartProps {
  jointAngles: JointAngles;
}
