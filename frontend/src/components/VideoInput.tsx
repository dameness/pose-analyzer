import { Pause, Play, Upload, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { VideoInputProps } from '../types';

type InputMode = 'record' | 'upload';

export function VideoInput({ recorder, onVideoReady, disabled = false }: VideoInputProps) {
  const [mode, setMode] = useState<InputMode>('record');

  function handleModeChange(next: InputMode) {
    if (next === mode) return;
    if (mode === 'record' && recorder.state.status === 'recording') {
      recorder.stopRecording();
    }
    setMode(next);
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Toggle pill */}
      <div className="flex bg-subtle rounded-full p-1">
        {(['record', 'upload'] as InputMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleModeChange(m)}
            disabled={disabled}
            className={[
              'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-full transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              mode === m
                ? 'bg-brand text-brand-fg shadow-sm'
                : 'text-muted hover:text-secondary',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            ].join(' ')}
          >
            {m === 'record' ? (
              <>
                <Video className="w-4 h-4" /> Gravar
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" /> Upload
              </>
            )}
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
      className="w-full rounded-t-2xl bg-raised max-h-96 object-contain"
    />
  );
}

function RecordMode({
  recorder,
  onVideoReady,
  disabled,
}: {
  recorder: VideoInputProps['recorder'];
  onVideoReady: (file: File) => void;
  disabled: boolean;
}) {
  const {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    reset,
    streamRef,
  } = recorder;
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.status === 'recording') {
      setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
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
    const type = state.videoBlob.type || 'video/webm';
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([state.videoBlob], `video.${ext}`, { type });
    onVideoReady(file);
  }

  function formatTime(seconds: number): string {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  if (state.status === 'idle') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 px-4 bg-raised rounded-2xl">
        <p className="text-sm text-muted text-center">
          Posicione-se de modo que seu corpo inteiro fique visível na câmera.
        </p>
        {state.error && <p className="text-sm text-error text-center">{state.error}</p>}
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          className="flex items-center gap-2 px-6 py-3 bg-brand text-brand-fg rounded-xl font-semibold text-sm hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          Iniciar gravação
        </button>
      </div>
    );
  }

  if (state.status === 'recording' || state.status === 'paused') {
    const pausado = state.status === 'paused';
    return (
      <div className="flex flex-col items-center gap-3 bg-raised rounded-2xl overflow-hidden">
        <LivePreview streamRef={streamRef} />
        <div className="flex flex-col items-center gap-3 pb-4">
          <span className="text-fg font-mono text-sm">{formatTime(elapsed)} / 00:30</span>
          {pausado && (
            <span className="text-xs text-warning font-semibold uppercase tracking-wide">
              Pausado
            </span>
          )}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={pausado ? resumeRecording : pauseRecording}
              disabled={disabled}
              className="w-12 h-12 rounded-full bg-warning hover:bg-warning/90 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
              aria-label={pausado ? 'Retomar gravação' : 'Pausar gravação'}
            >
              {pausado ? (
                <Play className="w-5 h-5 text-white fill-white" />
              ) : (
                <Pause className="w-5 h-5 text-white fill-white" />
              )}
            </button>
            <button
              type="button"
              onClick={stopRecording}
              disabled={disabled}
              className="w-14 h-14 rounded-full bg-error hover:bg-error/90 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
              aria-label="Parar gravação"
            >
              <span className="w-5 h-5 rounded-sm bg-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // status === 'stopped'
  return (
    <div className="flex flex-col gap-3">
      {state.videoUrl && (
        <video src={state.videoUrl} controls className="w-full rounded-2xl bg-raised max-h-72" />
      )}
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          disabled={disabled}
          className="flex-1 py-3 rounded-xl border-2 border-line text-fg font-semibold text-sm hover:border-strong transition-colors disabled:opacity-50 cursor-pointer"
        >
          ↩ Regravar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={disabled || !state.videoBlob}
          className="flex-1 py-3 rounded-xl bg-brand text-brand-fg font-semibold text-sm hover:bg-brand/90 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Analisar →
        </button>
      </div>
    </div>
  );
}

function UploadMode({
  onVideoReady,
  disabled,
}: {
  onVideoReady: (file: File) => void;
  disabled: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragCounter, setDragCounter] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragOver = dragCounter > 0;

  function handleFile(f: File) {
    const isVideo = f.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(f.name);
    if (!isVideo) return;
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragCounter(0);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) handleFile(picked);
    e.target.value = '';
  }

  function formatSize(bytes: number): string {
    if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(0)} KB`;
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
      className="hidden"
      onChange={handleChange}
      disabled={disabled}
    />
  );

  if (!file) {
    return (
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragCounter((c) => c + 1);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragCounter((c) => c - 1)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={[
          'flex flex-col items-center gap-3 py-10 px-4 rounded-2xl border-2 border-dashed transition-colors',
          dragOver
            ? 'border-accent bg-accent-subtle'
            : 'border-line bg-subtle',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-accent',
        ].join(' ')}
      >
        {hiddenInput}
        <span className="text-3xl">📁</span>
        <p className="text-sm font-semibold text-fg">Arraste um vídeo aqui</p>
        <p className="text-xs text-muted">ou clique para selecionar</p>
        <p className="text-xs text-muted">MP4, WebM ou MOV</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {hiddenInput}
      <div className="flex items-center gap-3 p-4 bg-subtle rounded-2xl border border-line">
        <span className="text-2xl shrink-0">🎬</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-fg truncate">{file.name}</p>
          <p className="text-xs text-muted">{formatSize(file.size)}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setFile(null)}
          disabled={disabled}
          className="flex-1 py-3 rounded-xl border-2 border-line text-fg font-semibold text-sm hover:border-strong transition-colors disabled:opacity-50 cursor-pointer"
        >
          ↩ Trocar arquivo
        </button>
        <button
          type="button"
          onClick={() => onVideoReady(file)}
          disabled={disabled}
          className="flex-1 py-3 rounded-xl bg-brand text-brand-fg font-semibold text-sm hover:bg-brand/90 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Analisar →
        </button>
      </div>
    </div>
  );
}
