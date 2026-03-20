import { useState, useRef, useEffect } from 'react';
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
            {m === 'record' ? '📷 Gravar' : '📁 Upload'}
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
  });
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

function RecordMode(_props: {
  recorder: ReturnType<typeof useVideoRecorder>;
  onVideoReady: (file: File) => void;
  disabled: boolean;
}) {
  return (
    <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-400">
      Gravar (em breve)
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
