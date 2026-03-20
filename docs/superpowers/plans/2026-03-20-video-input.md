# VideoInput Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the video recording/upload step (step 2) of the Pose Analyzer flow, including the `useVideoRecorder` hook, the `VideoInput` component, and updates to `Home.tsx` for step navigation.

**Architecture:** `useVideoRecorder` encapsulates the MediaRecorder API and exposes start/stop/reset actions plus `streamRef` for attaching the live stream to a `<video>` element. `VideoInput` renders a toggle pill to switch between record and upload modes, and calls `onVideoReady(file)` after user confirmation. `Home.tsx` adds a `step` state; `VideoInput` is always mounted (but hidden via CSS) once an exercise is selected, so going back to step 1 does not unmount the component and the recorded/uploaded video is preserved.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, lucide-react, MediaRecorder API (no test framework — verification via `tsc --noEmit` and `yarn build`)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/hooks/useVideoRecorder.ts` | MediaRecorder state machine (idle → recording → stopped), 30s limit, blob/URL management, exposes `streamRef` |
| Create | `src/components/VideoInput.tsx` | Toggle pill UI, record mode (with `LivePreview`), upload mode, preview+confirm, error display |
| Modify | `src/pages/Home.tsx` | Step state, always-mounted `VideoInput` (hidden via CSS when on step 1), step indicator, wire up `onVideoReady` → `analysis.submit` |

No new types needed — `VideoRecorderState`, `RecordingStatus`, and `VideoInputProps` are already defined in `src/types/index.ts`.

**`useAnalysis` return shape** (already implemented in `src/hooks/useAnalysis.ts`):
```ts
{
  state: {
    phase: 'idle' | 'uploading' | 'polling' | 'done' | 'error';
    jobId: string | null;
    result: AnalysisResult | null;
    error: string | null;
  };
  submit: (file: File, exercise: ExerciseType) => Promise<void>;
  reset: () => void;
}
```
Use `analysis.state.phase !== 'idle'` to determine when interactions should be disabled.

---

## Task 1: `useVideoRecorder` hook

**Files:**
- Create: `src/hooks/useVideoRecorder.ts`

**Reference types** (already in `src/types/index.ts`):
```ts
type RecordingStatus = 'idle' | 'recording' | 'stopped';
interface VideoRecorderState {
  status: RecordingStatus;
  videoBlob: Blob | null;
  videoUrl: string | null;
  error: string | null;
}
```

- [ ] **Step 1: Create the complete hook**

```ts
// src/hooks/useVideoRecorder.ts
import { useState, useRef, useEffect } from 'react';
import type { VideoRecorderState } from '../types';

const INITIAL_STATE: VideoRecorderState = {
  status: 'idle',
  videoBlob: null,
  videoUrl: null,
  error: null,
};

export function useVideoRecorder(): {
  state: VideoRecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
  streamRef: React.MutableRefObject<MediaStream | null>;
} {
  const [state, setState] = useState<VideoRecorderState>(INITIAL_STATE);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef<string | null>(null);

  function cleanup() {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }

  useEffect(() => () => cleanup(), []);

  async function startRecording(): Promise<void> {
    cleanup();
    chunksRef.current = [];
    setState({ status: 'idle', videoBlob: null, videoUrl: null, error: null });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Permissão para câmera negada. Verifique as configurações do navegador.'
          : err instanceof DOMException && err.name === 'NotFoundError'
          ? 'Nenhuma câmera encontrada neste dispositivo.'
          : 'Não foi possível acessar a câmera.';
      setState(prev => ({ ...prev, error: message }));
      return;
    }

    streamRef.current = stream;
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setState({ status: 'stopped', videoBlob: blob, videoUrl: url, error: null });
    };

    recorder.start();
    setState({ status: 'recording', videoBlob: null, videoUrl: null, error: null });

    timeoutRef.current = setTimeout(() => stopRecording(), 30_000);
  }

  function stopRecording(): void {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  function reset(): void {
    cleanup();
    setState(INITIAL_STATE);
  }

  return { state, startRecording, stopRecording, reset, streamRef };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useVideoRecorder.ts
git commit -m "feat: add useVideoRecorder hook with MediaRecorder API"
```

---

## Task 2: `VideoInput` — skeleton + toggle pill

**Files:**
- Create: `src/components/VideoInput.tsx`

- [ ] **Step 1: Create component skeleton with toggle pill and placeholder sub-components**

```tsx
// src/components/VideoInput.tsx
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

function LivePreview({ streamRef }: { streamRef: React.MutableRefObject<MediaStream | null> }) {
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
```

Note: `LivePreview` is defined here (before `RecordMode`) so it's available when `RecordMode` is fully implemented in Task 3.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoInput.tsx
git commit -m "feat: add VideoInput skeleton with toggle pill"
```

---

## Task 3: `VideoInput` — Record mode

**Files:**
- Modify: `src/components/VideoInput.tsx` (replace `RecordMode` placeholder)

- [ ] **Step 1: Replace `RecordMode` with full implementation**

`RecordMode` receives the entire `recorder` object (from `useVideoRecorder`) via props. It destructures `state`, `startRecording`, `stopRecording`, `reset`, and `streamRef` from it — `streamRef` is passed to `LivePreview` to attach the live camera stream.

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoInput.tsx
git commit -m "feat: implement record mode in VideoInput"
```

---

## Task 4: `VideoInput` — Upload mode

**Files:**
- Modify: `src/components/VideoInput.tsx` (replace `UploadMode` placeholder)

- [ ] **Step 1: Replace `UploadMode` with full implementation**

`UploadMode` manages a single `<input type="file">` ref. The same `inputRef` is reused across both the empty and file-selected states. Only the file-selected state renders a second hidden input (to allow "Trocar arquivo" to open the picker again).

```tsx
function UploadMode({
  onVideoReady,
  disabled,
}: {
  onVideoReady: (file: File) => void;
  disabled: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (!f.type.startsWith('video/')) return;
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) handleFile(picked);
    // reset input value so same file can be re-selected after "Trocar"
    e.target.value = '';
  }

  function formatSize(bytes: number): string {
    if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(0)} KB`;
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }

  // Single hidden input used for both dropzone click and "Trocar arquivo"
  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept="video/mp4,video/webm"
      className="hidden"
      onChange={handleChange}
      disabled={disabled}
    />
  );

  if (!file) {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={[
          'flex flex-col items-center gap-3 py-10 px-4 rounded-2xl border-2 border-dashed transition-colors',
          dragOver
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-indigo-400',
        ].join(' ')}
      >
        {hiddenInput}
        <span className="text-3xl">📁</span>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Arraste um vídeo aqui
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          ou clique para selecionar
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">MP4 ou WebM</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {hiddenInput}
      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
        <span className="text-2xl shrink-0">🎬</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{file.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{formatSize(file.size)}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { setFile(null); inputRef.current?.click(); }}
          disabled={disabled}
          className="flex-1 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:border-gray-400 transition-colors disabled:opacity-50 cursor-pointer"
        >
          ↩ Trocar arquivo
        </button>
        <button
          type="button"
          onClick={() => onVideoReady(file)}
          disabled={disabled}
          className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Analisar →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoInput.tsx
git commit -m "feat: implement upload mode in VideoInput"
```

---

## Task 5: Update `Home.tsx` — step navigation + wire-up

**Files:**
- Modify: `src/pages/Home.tsx`

**Key design decision:** `VideoInput` is rendered at all times once an exercise is selected, but hidden via the `hidden` CSS class when `step === 'select'`. This keeps the `useVideoRecorder` hook mounted, so going back to step 1 and returning to step 2 preserves the recorded/uploaded video (per spec).

`useAnalysis` is already implemented in `src/hooks/useAnalysis.ts` and returns:
```ts
{ state: { phase: 'idle' | 'uploading' | 'polling' | 'done' | 'error'; ... }; submit: (file, exercise) => Promise<void>; reset: () => void; }
```

- [ ] **Step 1: Add imports**

Replace all existing imports at the top of `Home.tsx`:

```tsx
import { useState } from 'react';
import { ArrowLeft, Check, ChevronRight, ScanLine } from 'lucide-react';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { VideoInput } from '../components/VideoInput';
import { useAnalysis } from '../hooks/useAnalysis';
import type { ExerciseType } from '../types';
```

- [ ] **Step 2: Add step state and `useAnalysis` inside `Home`**

```tsx
const [step, setStep] = useState<'select' | 'video'>('select');
const analysis = useAnalysis();
```

- [ ] **Step 3: Replace `handleContinue` and add handlers**

Remove the existing `handleContinue` and add:

```tsx
function handleContinue() {
  if (!selectedExercise) return;
  setStep('video');
}

function handleVideoReady(file: File) {
  if (!selectedExercise) return;
  void analysis.submit(file, selectedExercise);
}

function handleBack() {
  setStep('select');
}
```

- [ ] **Step 4: Update the step indicator JSX**

Replace the existing step indicator block:

```tsx
{/* Step indicator */}
<div className="flex items-center gap-2 text-sm">
  <span
    className={[
      'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 transition-colors',
      step === 'select' ? 'bg-indigo-600 text-white' : 'bg-green-500 text-white',
    ].join(' ')}
  >
    {step === 'select' ? '1' : <Check className="w-3 h-3" />}
  </span>
  <span
    className={[
      'font-medium transition-colors',
      step === 'select' ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500',
    ].join(' ')}
  >
    Escolha o exercício
  </span>
  <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-1" />
  <span
    className={[
      'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 transition-colors',
      step === 'video'
        ? 'bg-indigo-600 text-white'
        : 'border-2 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500',
    ].join(' ')}
  >
    2
  </span>
  <span
    className={[
      'transition-colors',
      step === 'video' ? 'font-medium text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500',
    ].join(' ')}
  >
    Enviar vídeo
  </span>
  <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-1" />
  <span className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-400 dark:text-gray-500 shrink-0">
    3
  </span>
  <span className="text-gray-400 dark:text-gray-500">Resultado</span>
</div>
```

- [ ] **Step 5: Replace the main content area**

Replace everything inside `<main>` after the step indicator (the heading, ExerciseSelector, and continue button) with:

```tsx
{/* Step 1: Exercise selection */}
{step === 'select' && (
  <>
    <div className="flex flex-col gap-1">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Qual exercício você vai realizar?
      </h2>
      <p className="text-gray-500 dark:text-gray-400">
        Selecione o exercício para que a IA possa analisar sua postura corretamente.
      </p>
    </div>

    <ExerciseSelector selected={selectedExercise} onSelect={setSelectedExercise} />

    <div className="flex justify-end pt-2">
      <button
        type="button"
        onClick={handleContinue}
        disabled={!selectedExercise}
        className={[
          'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
          selectedExercise
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
            : 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed',
        ].join(' ')}
      >
        Continuar
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </>
)}

{/* Step 2: Video input — always mounted (hidden via CSS) once exercise selected, to preserve recorder state across back navigation */}
{selectedExercise !== null && (
  <div className={step === 'video' ? 'flex flex-col gap-6' : 'hidden'}>
    <div className="flex flex-col gap-1">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Grave ou envie o vídeo
      </h2>
      <p className="text-gray-500 dark:text-gray-400">
        Exercício selecionado:{' '}
        <span className="font-medium text-indigo-600 dark:text-indigo-400 capitalize">
          {selectedExercise}
        </span>
      </p>
    </div>

    <VideoInput
      onVideoReady={handleVideoReady}
      disabled={analysis.state.phase !== 'idle'}
    />

    <div className="flex justify-start">
      <button
        type="button"
        onClick={handleBack}
        disabled={analysis.state.phase !== 'idle'}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run the dev server and manually verify the flow**

```bash
yarn dev
```

Checklist:
- [ ] Step 1 renders — can select an exercise, Continuar enables
- [ ] Clicking Continuar advances to step 2 — step indicator updates
- [ ] Toggle pill switches between Gravar and Upload
- [ ] Record mode `idle`: "Iniciar gravação" button + positioning tip visible
- [ ] Record mode `recording`: camera permission prompt → live preview + `00:00 / 00:30` timer counting up + red stop button
- [ ] Record mode `stopped`: recorded video preview + Regravar + Analisar buttons
- [ ] Regravar resets recorder to `idle`
- [ ] Analisar → calls `onVideoReady` (in mock mode: enters loading after ~3s)
- [ ] Upload mode: dropzone visible, clicking opens file picker, drag & drop works
- [ ] Upload mode file selected: name/size shown + Trocar arquivo + Analisar buttons
- [ ] Trocar arquivo reopens file picker
- [ ] Voltar returns to step 1; Continuar goes back to step 2 with video still present

- [ ] **Step 8: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat: add step navigation and wire up VideoInput in Home"
```

---

## Task 6: Final build check

- [ ] **Step 1: Run full TypeScript + Vite build**

```bash
yarn build
```

Expected: compiles with no types errors, `dist/` directory produced successfully.

- [ ] **Step 2: Commit any fixes needed**

```bash
git add -p
git commit -m "fix: address build issues"
```
