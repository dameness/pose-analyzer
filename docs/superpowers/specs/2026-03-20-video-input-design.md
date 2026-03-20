# VideoInput — Design Spec

**Date:** 2026-03-20
**Status:** Approved

---

## Overview

Implement the video recording/upload step (step 2) of the Pose Analyzer flow. This includes:

- `src/hooks/useVideoRecorder.ts` — MediaRecorder API encapsulation
- `src/components/VideoInput.tsx` — UI component
- Update `src/pages/Home.tsx` — integrate step 2 into the existing step flow

---

## UX Decisions

| Question | Decision |
|---|---|
| Mode switcher layout | Toggle pill (segmented control, iOS-style) |
| After recording/upload | Preview + confirm (user reviews before submitting) |
| Upload area | Dropzone with drag & drop + click to browse |

---

## `useVideoRecorder` Hook

### State

Uses the existing `VideoRecorderState` interface from `types/index.ts`:

```ts
interface VideoRecorderState {
  status: 'idle' | 'recording' | 'stopped';
  videoBlob: Blob | null;
  videoUrl: string | null;
  error: string | null;
}
```

### Exposed API

```ts
{
  state: VideoRecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
}
```

### Implementation Details

- Requests `getUserMedia({ video: true, audio: false })`
- Records in `video/webm` (best cross-browser support per CLAUDE.md)
- 30-second hard limit: `setTimeout` calls `stopRecording()` automatically
- `videoUrl` created with `URL.createObjectURL` — revoked in cleanup to avoid memory leaks
- All timers and media tracks cleaned up in `useEffect` return

### Error States

- Permission denied (`NotAllowedError`)
- Camera not available (`NotFoundError`)
- Generic fallback message

---

## `VideoInput` Component

### Props

```ts
interface VideoInputProps {
  onVideoReady: (file: File) => void;
  disabled?: boolean;
}
```

### Layout

Toggle pill at the top switches between two modes. Below it, the content area changes based on mode and recording state.

### Mode: Gravar (Record)

| Recording State | What's shown |
|---|---|
| `idle` | Dark placeholder area + "Iniciar gravação" button + positioning tip |
| `recording` | Live camera preview (`<video srcObject>`) + countdown timer + red stop button |
| `stopped` | Recorded video preview (`<video src={videoUrl}>`) + "Regravar" button + "Analisar →" button |

When "Analisar →" is clicked: creates a `File` from the `videoBlob` (`video.webm`) and calls `onVideoReady(file)`.

### Mode: Upload

| Upload State | What's shown |
|---|---|
| No file | Dropzone (dashed border, drag & drop + click to open file picker) with format hint |
| File selected | File name + size + "Trocar arquivo" button + "Analisar →" button |

- Accepts `video/mp4, video/webm`
- Drag & drop via `onDragOver` / `onDrop` events
- Click opens hidden `<input type="file">` via ref

When "Analisar →" is clicked: calls `onVideoReady(file)` with the selected `File`.

### Error Display

Inline error message below the content area (red text with icon). Shown for:
- Camera permission denied
- Unsupported file format

### Disabled State

When `disabled={true}`, all interactions are blocked (used while analysis is in progress).

---

## `Home.tsx` Updates

### Step State

Add local state: `step: 'select' | 'video'`

Clicking "Continuar" on step 1 sets `step = 'video'`.

### Rendering

```
step === 'select'  →  ExerciseSelector + Continuar button
step === 'video'   →  VideoInput with onVideoReady handler
```

The `onVideoReady` handler calls `analysis.submit(file, selectedExercise)`.

### Step Indicator

Update the existing step indicator to highlight the active step:
- Step 1 active: circle filled (indigo), steps 2–3 outlined
- Step 2 active: step 1 shows checkmark, step 2 filled, step 3 outlined

---

## Data Flow

```
Home (step=video)
  └── VideoInput
        ├── useVideoRecorder (mode: record)
        │     └── MediaRecorder API
        └── <input type="file"> (mode: upload)

onVideoReady(file) →
  Home.handleVideoReady(file) →
    analysis.submit(file, exercise) →
      POST /analyze → polling → result
```

---

## Out of Scope

- Audio recording
- Video trimming or editing
- File size validation beyond format check
- Progress bar during upload (handled by `AnalysisStatus` component, next step)
