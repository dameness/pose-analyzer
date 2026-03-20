import { useState, useRef, useEffect } from 'react';
import { Video, Upload } from 'lucide-react';
import type { VideoInputProps } from '../types';
import { useVideoRecorder } from '../hooks/useVideoRecorder';

type InputMode = 'record' | 'upload';

export function VideoInput({ onVideoReady, disabled = false }: VideoInputProps) {
  const [mode, setMode] = useState<InputMode>('record');
  const recorder = useVideoRecorder();

  function handleModeChange(next: InputMode) {
    if (next === mode) return;
    setMode(next);
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Toggle pill */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-full p-1">
        {(['record', 'upload'] as InputMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleModeChange(m)}
            disabled={disabled}
            className={[
              'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-full transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              mode === m
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            ].join(' ')}
          >
            {m === 'record' ? <><Video className="w-4 h-4" /> Gravar</> : <><Upload className="w-4 h-4" /> Upload</>}
          </button>
        ))}
      </div>

      {/* Content area */}
      {mode === 'record' ? (
        <RecordMode recorder={recorder} onVideoReady={onVideoReady} disabled={disabled} />
      ) : (
        <UploadMode onVideoReady={onVideoReady} disabled={disabled} />
      )}
    </div>
  );
}

// Sub-components defined below — implemented in Tasks 3 & 4

function LivePreview({ streamRef }: { streamRef: React.RefObject<MediaStream | null> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, []);
  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-full rounded-t-2xl bg-gray-900 max-h-60 object-cover"
    />
  );
}

function RecordMode({
  recorder,
  onVideoReady,
  disabled,
}: {
  recorder: ReturnType<typeof useVideoRecorder>;
  onVideoReady: (file: File) => void;
  disabled: boolean;
}) {
  const { state, startRecording, stopRecording, reset, streamRef } = recorder;
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.status === 'recording') {
      setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
    }
    return () => {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
    };
  }, [state.status]);

  function handleConfirm() {
    if (!state.videoBlob) return;
    const file = new File([state.videoBlob], 'video.webm', { type: 'video/webm' });
    onVideoReady(file);
  }

  function formatTime(seconds: number): string {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  if (state.status === 'idle') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 px-4 bg-gray-900 rounded-2xl">
        <p className="text-sm text-gray-400 text-center">
          Posicione-se de modo que seu corpo inteiro fique visível na câmera.
        </p>
        {state.error && (
          <p className="text-sm text-red-400 text-center">{state.error}</p>
        )}
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          Iniciar gravação
        </button>
      </div>
    );
  }

  if (state.status === 'recording') {
    return (
      <div className="flex flex-col items-center gap-3 bg-gray-900 rounded-2xl overflow-hidden">
        <LivePreview streamRef={streamRef} />
        <div className="flex flex-col items-center gap-3 pb-4">
          <span className="text-white font-mono text-sm">
            {formatTime(elapsed)} / 00:30
          </span>
          <button
            type="button"
            onClick={stopRecording}
            disabled={disabled}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Parar gravação"
          >
            <span className="w-5 h-5 rounded-sm bg-white" />
          </button>
        </div>
      </div>
    );
  }

  // status === 'stopped'
  return (
    <div className="flex flex-col gap-3">
      {state.videoUrl && (
        <video
          src={state.videoUrl}
          controls
          className="w-full rounded-2xl bg-gray-900 max-h-72"
        />
      )}
      {state.error && (
        <p className="text-sm text-red-500">{state.error}</p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          disabled={disabled}
          className="flex-1 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:border-gray-400 transition-colors disabled:opacity-50 cursor-pointer"
        >
          ↩ Regravar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={disabled || !state.videoBlob}
          className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Analisar →
        </button>
      </div>
    </div>
  );
}

function UploadMode(_props: {
  onVideoReady: (file: File) => void;
  disabled: boolean;
}) {
  return (
    <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-400">
      Upload (em breve)
    </div>
  );
}
