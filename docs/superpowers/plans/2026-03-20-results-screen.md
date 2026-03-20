# Results Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full results screen (step 3) including loading state, per-joint feedback, angle chart, and result display, wiring everything into `Home.tsx`.

**Architecture:** Four new components (`AnalysisStatus`, `JointFeedback`, `AngleChart`, `AnalysisResult`) rendered as siblings after the step 2 block in `Home.tsx`, conditioned on `analysis.state.phase`. The step indicator is updated to reflect all phases. No existing files other than `Home.tsx` are modified.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Recharts (to be installed), lucide-react.

**Note on tests:** This project has no test framework configured. Verification at each task uses `yarn build` (runs `tsc -b && vite build`) to confirm TypeScript correctness and no build errors. Visual verification is done via `yarn dev` with mock data (works when `VITE_API_URL` is unset — mock returns squat/incorrect/87%/joelho error after ~6s).

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/JointFeedback.tsx` | Create | Single joint indicator card (correct/incorrect) |
| `src/components/AngleChart.tsx` | Create | Recharts line chart of joint angles over frames |
| `src/components/AnalysisStatus.tsx` | Create | Loading screen shown during uploading/polling |
| `src/components/AnalysisResult.tsx` | Create | Full result layout (verdict + joints + errors + chart + reset) |
| `src/pages/Home.tsx` | Modify | Add handleReset, new render blocks, update step indicator |

---

## Task 1: Install recharts

**Files:**
- Modify: `package.json` (via yarn)

- [ ] **Step 1: Install recharts**

```bash
cd /home/veplex13/pose-analyzer && yarn add recharts
```

Expected: recharts and its peer deps added to `node_modules/`. `package.json` gains a `"recharts"` entry under `dependencies`.

- [ ] **Step 2: Verify TypeScript types ship with recharts**

```bash
ls node_modules/recharts/types 2>/dev/null && echo "types found" || echo "no types dir"
# OR
ls node_modules/recharts/*.d.ts 2>/dev/null | head -3
```

If no types found: `yarn add -D @types/recharts`. (recharts v2+ ships its own — this step should output "types found".)

- [ ] **Step 3: Verify build still passes**

```bash
cd /home/veplex13/pose-analyzer && yarn build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: install recharts"
```

---

## Task 2: JointFeedback component

**Files:**
- Create: `src/components/JointFeedback.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/JointFeedback.tsx`:

```tsx
import { CheckCircle2, XCircle } from 'lucide-react';
import type { JointFeedbackProps } from '../types';

export function JointFeedback({ joint, correct }: JointFeedbackProps) {
  return (
    <div
      className={[
        'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
        correct
          ? 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300'
          : 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300',
      ].join(' ')}
    >
      {correct
        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
        : <XCircle className="w-4 h-4 shrink-0" />}
      <span>{joint}</span>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /home/veplex13/pose-analyzer && yarn build
```

Expected: Build succeeds. No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/JointFeedback.tsx
git commit -m "feat: add JointFeedback component"
```

---

## Task 3: AngleChart component

**Files:**
- Create: `src/components/AngleChart.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/AngleChart.tsx`:

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { AngleChartProps } from '../types';

const LINE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

export function AngleChart({ jointAngles }: AngleChartProps) {
  const joints = Object.entries(jointAngles).filter(([, values]) => values.length > 0);

  if (joints.length === 0) return null;

  // Build data array: one object per frame index, with each joint as a key
  const frameCount = Math.max(...joints.map(([, v]) => v.length));
  const data = Array.from({ length: frameCount }, (_, i) => {
    const point: Record<string, number> = { frame: i + 1 };
    for (const [joint, values] of joints) {
      if (i < values.length) point[joint] = values[i];
    }
    return point;
  });

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <XAxis
            dataKey="frame"
            label={{ value: 'Frame', position: 'insideBottom', offset: -2, fontSize: 12 }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            label={{ value: 'Ângulo (°)', angle: -90, position: 'insideLeft', fontSize: 12 }}
            tick={{ fontSize: 11 }}
          />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {joints.map(([joint], index) => (
            <Line
              key={joint}
              type="monotone"
              dataKey={joint}
              stroke={LINE_COLORS[index % LINE_COLORS.length]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /home/veplex13/pose-analyzer && yarn build
```

Expected: Build succeeds. No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AngleChart.tsx
git commit -m "feat: add AngleChart component"
```

---

## Task 4: AnalysisStatus component

**Files:**
- Create: `src/components/AnalysisStatus.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/AnalysisStatus.tsx`:

```tsx
import type { AnalysisStatusProps } from '../types';

export function AnalysisStatus({ phase }: AnalysisStatusProps) {
  const text = phase === 'uploading' ? 'Enviando vídeo...' : 'Analisando sua postura...';

  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <div className="w-14 h-14 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />

      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{text}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aguarde, isso pode levar alguns segundos
        </p>
      </div>

      <div className="w-48 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-600 rounded-full animate-pulse w-full" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /home/veplex13/pose-analyzer && yarn build
```

Expected: Build succeeds. No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AnalysisStatus.tsx
git commit -m "feat: add AnalysisStatus component"
```

---

## Task 5: AnalysisResult component

**Files:**
- Create: `src/components/AnalysisResult.tsx`

This component depends on `JointFeedback` and `AngleChart` (Tasks 2 and 3 must be complete).

The joint list per exercise:
- `squat` → `['joelho', 'quadril', 'tornozelo']`
- `situp` → `['quadril', 'coluna']`
- `pushup` → `['cotovelo', 'ombro', 'quadril']`

A joint is `incorrect` if any string in `result.errors` contains its name as a case-insensitive substring.

- [ ] **Step 1: Create the component**

Create `src/components/AnalysisResult.tsx`:

```tsx
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import type { AnalysisResultProps, ExerciseType } from '../types';
import { JointFeedback } from './JointFeedback';
import { AngleChart } from './AngleChart';

const JOINTS_BY_EXERCISE: Record<ExerciseType, string[]> = {
  squat: ['joelho', 'quadril', 'tornozelo'],
  situp: ['quadril', 'coluna'],
  pushup: ['cotovelo', 'ombro', 'quadril'],
};

function isJointCorrect(joint: string, errors: string[]): boolean {
  const name = joint.toLowerCase();
  return !errors.some(e => e.toLowerCase().includes(name));
}

export function AnalysisResult({ result, onReset }: AnalysisResultProps) {
  const correct = result.result === 'correct';
  const joints = JOINTS_BY_EXERCISE[result.exercise];
  const confidence = Math.round(result.confidence * 100);

  return (
    <div className="flex flex-col gap-6">

      {/* 1. Verdict header */}
      <div
        className={[
          'flex flex-col items-center gap-2 rounded-2xl px-6 py-6 text-center',
          correct
            ? 'bg-green-50 dark:bg-green-950/30'
            : 'bg-red-50 dark:bg-red-950/30',
        ].join(' ')}
      >
        {correct
          ? <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          : <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />}
        <p
          className={[
            'text-xl font-bold',
            correct
              ? 'text-green-800 dark:text-green-300'
              : 'text-red-800 dark:text-red-300',
          ].join(' ')}
        >
          {correct ? 'Execução Correta' : 'Execução Incorreta'}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {confidence}% de confiança · {result.frames_analyzed} frames analisados
        </p>
      </div>

      {/* 2. Joint grid */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Articulações
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {joints.map(joint => (
            <JointFeedback
              key={joint}
              joint={joint}
              correct={isJointCorrect(joint, result.errors)}
            />
          ))}
        </div>
      </div>

      {/* 3. Error list (only when errors exist) */}
      {result.errors.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Erros detectados
          </h3>
          <div className="flex gap-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 px-4 py-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <ul className="flex flex-col gap-1">
              {result.errors.map((error, i) => (
                <li key={i} className="text-sm text-amber-800 dark:text-amber-300">
                  {error}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 4. Angle chart */}
      {Object.keys(result.joint_angles).length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Ângulos por frame
          </h3>
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
            <AngleChart jointAngles={result.joint_angles} />
          </div>
        </div>
      )}

      {/* 5. Reset button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <RotateCcw className="w-4 h-4" />
          Analisar novamente
        </button>
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /home/veplex13/pose-analyzer && yarn build
```

Expected: Build succeeds. No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AnalysisResult.tsx
git commit -m "feat: add AnalysisResult component"
```

---

## Task 6: Wire up Home.tsx

**Files:**
- Modify: `src/pages/Home.tsx`

This is the integration task. Changes:
1. Import four new components
2. Add `handleReset` function
3. Add new render blocks (AnalysisStatus / AnalysisResult / error card) as siblings after the step 2 div
4. Update step 2's indicator from a two-state to a three-state condition
5. Replace the static step 3 `<span>` with a dynamic conditional element

- [ ] **Step 1: Add imports**

At the top of `src/pages/Home.tsx`, after the existing imports, add:

```tsx
import { AnalysisStatus } from '../components/AnalysisStatus';
import { AnalysisResult } from '../components/AnalysisResult';
```

(JointFeedback and AngleChart are used inside AnalysisResult — no direct import needed in Home.)

Also add `AlertCircle` to the existing lucide-react import:

```tsx
// Before:
import { ArrowLeft, Check, ChevronRight, ScanLine } from 'lucide-react';
// After:
import { AlertCircle, ArrowLeft, Check, ChevronRight, ScanLine } from 'lucide-react';
```

- [ ] **Step 2: Add handleReset**

Inside the `Home` function, after `handleBack`, add:

```tsx
function handleReset() {
  analysis.reset();
  // step stays 'video' — VideoInput re-enables and user can resubmit
}
```

- [ ] **Step 3: Add new render blocks after the step 2 div**

In the JSX, locate the closing `)}` of the step 2 block (the one that wraps `VideoInput`). After it, before the closing `</main>`, add:

```tsx
{/* Step 3a: Loading */}
{(analysis.state.phase === 'uploading' || analysis.state.phase === 'polling') && (
  <AnalysisStatus phase={analysis.state.phase} />
)}

{/* Step 3b: Result */}
{analysis.state.phase === 'done' && analysis.state.result !== null && (
  <AnalysisResult
    result={analysis.state.result}
    exercise={selectedExercise!}
    onReset={handleReset}
  />
)}

{/* Step 3c: Error */}
{analysis.state.phase === 'error' && (
  <div className="flex flex-col items-center gap-4 rounded-2xl bg-red-50 dark:bg-red-950/30 px-6 py-8 text-center">
    <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
    <div className="flex flex-col gap-1">
      <p className="text-lg font-semibold text-red-800 dark:text-red-300">Erro na análise</p>
      <p className="text-sm text-red-600 dark:text-red-400">{analysis.state.error}</p>
    </div>
    <button
      type="button"
      onClick={handleReset}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors cursor-pointer"
    >
      Tentar novamente
    </button>
  </div>
)}
```

- [ ] **Step 4: Update step 2 indicator — circle**

Find the step 2 circle button. Its current `className` array includes this ternary:

```tsx
step === 'video'
  ? 'bg-indigo-600 text-white'
  : 'border-2 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500',
```

Replace it with a three-way condition:

```tsx
analysis.state.phase !== 'idle'
  ? 'bg-green-500 text-white'
  : step === 'video'
    ? 'bg-indigo-600 text-white'
    : 'border-2 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500',
```

Also update the circle's content. Currently it shows `2`. Change it to:

```tsx
{analysis.state.phase !== 'idle' ? <Check className="w-3 h-3" /> : '2'}
```

- [ ] **Step 5: Update step 2 indicator — label**

Find the step 2 label button. Its `className` includes:

```tsx
step === 'video' ? 'font-medium text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500',
```

Replace with:

```tsx
analysis.state.phase !== 'idle'
  ? 'text-gray-400 dark:text-gray-500'
  : step === 'video'
    ? 'font-medium text-gray-700 dark:text-gray-300'
    : 'text-gray-400 dark:text-gray-500',
```

- [ ] **Step 6: Update step 2 indicator — onClick/disabled conditions**

The step 2 button's `onClick` and `disabled` currently test `selectedExercise !== null && step === 'select' && analysis.state.phase === 'idle'`. This condition already includes `analysis.state.phase === 'idle'`, so the button is already inert once uploading starts. **No change needed here.**

- [ ] **Step 7: Replace static step 3 `<span>` with dynamic element**

Find the static step 3 indicator (currently a plain `<span>` with no interactivity):

```tsx
<span className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-400 dark:text-gray-500 shrink-0">
  3
</span>
<span className="text-gray-400 dark:text-gray-500">Resultado</span>
```

Replace with:

```tsx
<span
  className={[
    'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 transition-colors',
    analysis.state.phase === 'done'
      ? 'bg-green-500 text-white'
      : analysis.state.phase === 'uploading' || analysis.state.phase === 'polling'
        ? 'bg-indigo-600 text-white'
        : 'border-2 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500',
  ].join(' ')}
>
  {analysis.state.phase === 'done' ? <Check className="w-3 h-3" /> : '3'}
</span>
<span
  className={[
    'transition-colors',
    analysis.state.phase === 'uploading' || analysis.state.phase === 'polling'
      ? 'font-medium text-gray-700 dark:text-gray-300'
      : analysis.state.phase === 'done'
        ? 'text-gray-400 dark:text-gray-500'
        : 'text-gray-400 dark:text-gray-500',
  ].join(' ')}
>
  Resultado
</span>
```

- [ ] **Step 8: Verify build**

```bash
cd /home/veplex13/pose-analyzer && yarn build
```

Expected: Build succeeds. No TypeScript errors.

- [ ] **Step 9: Manual smoke test with mock data**

```bash
cd /home/veplex13/pose-analyzer && yarn dev
```

1. Open browser at `http://localhost:5173` (or the printed URL)
2. Select "Agachamento" → click Continuar
3. In the upload tab, select any video file → click "Analisar →"
4. **Verify:** Step indicator advances to step 3 (indigo "3"), spinner appears with "Enviando vídeo..." then "Analisando sua postura..."
5. After ~6s: **Verify:** Step 3 turns green check, result screen appears with:
   - Red "Execução Incorreta" badge, 87% confiança, 42 frames
   - joelho = red (incorrect), quadril = green, tornozelo = green
   - Error card: "joelho passando a ponta do pé"
   - Angle chart with 3 lines (knee, hip, ankle)
   - "Analisar novamente" button
6. Click "Analisar novamente" → **Verify:** returns to VideoInput on step 2

- [ ] **Step 10: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat: wire results screen into Home"
```
