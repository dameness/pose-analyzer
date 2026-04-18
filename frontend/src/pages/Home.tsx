import { AlertCircle, ArrowLeft, Check, ChevronRight, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AnalysisResult } from '../components/AnalysisResult';
import { AnalysisStatus } from '../components/AnalysisStatus';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { VideoInput } from '../components/VideoInput';
import { useAnalysis } from '../hooks/useAnalysis';
import { useVideoRecorder } from '../hooks/useVideoRecorder';
import type { ExerciseType } from '../types';

const EXERCISE_LABELS: Record<ExerciseType, string> = {
  squat: 'Agachamento',
  situp: 'Abdominal',
  pushup: 'Flexão',
};

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

export function Home() {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType | null>(null);
  const [step, setStep] = useState<'select' | 'video'>('select');
  const analysis = useAnalysis();
  const recorder = useVideoRecorder();
  const { dark, toggle: toggleDark } = useDarkMode();

  function handleContinue() {
    if (!selectedExercise) return;
    setStep('video');
  }

  function handleVideoReady(file: File) {
    if (!selectedExercise) return;
    void analysis.submit(file, selectedExercise);
  }

  function handleBack() {
    if (recorder.state.status === 'recording' || recorder.state.status === 'paused') {
      recorder.stopRecording();
    }
    analysis.reset();
    setStep('select');
  }

  function handleReset() {
    analysis.reset();
  }

  return (
    <div className="min-h-screen bg-subtle flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-line shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
            <img src="favicon.svg" alt="Dumbbell with a Brain" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-fg leading-tight">Pose Analyzer</h1>
            <p className="text-xs text-muted">Análise postural com IA</p>
          </div>
          <button
            type="button"
            onClick={toggleDark}
            aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            className={[
              'relative w-14 h-7 rounded-full transition-colors duration-300 cursor-pointer shrink-0',
              dark ? 'bg-brand' : 'bg-raised',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-1 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center transition-all duration-300',
                dark ? 'left-8' : 'left-1',
              ].join(' ')}
            >
              {dark ? (
                <Moon className="w-3 h-3 text-brand-fg" />
              ) : (
                <Sun className="w-3 h-3 text-muted" />
              )}
            </span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={step === 'video' && analysis.state.phase === 'idle' ? handleBack : undefined}
            disabled={!(step === 'video' && analysis.state.phase === 'idle')}
            className={[
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 transition-colors',
              step === 'select' ? 'bg-brand text-brand-fg' : 'bg-success text-white',
              step === 'video' && analysis.state.phase === 'idle'
                ? 'cursor-pointer hover:ring-2 hover:ring-success hover:ring-offset-1'
                : 'cursor-default',
            ].join(' ')}
          >
            {step === 'select' ? '1' : <Check className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={step === 'video' && analysis.state.phase === 'idle' ? handleBack : undefined}
            disabled={!(step === 'video' && analysis.state.phase === 'idle')}
            className={[
              'font-medium transition-colors',
              step === 'select' ? 'text-secondary' : 'text-muted',
              step === 'video' && analysis.state.phase === 'idle'
                ? 'cursor-pointer hover:text-secondary'
                : 'cursor-default',
            ].join(' ')}
          >
            Escolha o exercício
          </button>
          <span className="flex-1 h-px bg-line ml-1" />
          <button
            type="button"
            onClick={
              selectedExercise !== null && step === 'select' && analysis.state.phase === 'idle'
                ? handleContinue
                : undefined
            }
            disabled={
              !(selectedExercise !== null && step === 'select' && analysis.state.phase === 'idle')
            }
            className={[
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 transition-colors',
              analysis.state.phase !== 'idle' && analysis.state.phase !== 'error'
                ? 'bg-success text-white'
                : step === 'video'
                ? 'bg-brand text-brand-fg'
                : 'border-2 border-line text-muted',
              selectedExercise !== null && step === 'select' && analysis.state.phase === 'idle'
                ? 'cursor-pointer hover:border-accent hover:text-accent'
                : 'cursor-default',
            ].join(' ')}
          >
            {analysis.state.phase !== 'idle' && analysis.state.phase !== 'error' ? (
              <Check className="w-3 h-3" />
            ) : (
              '2'
            )}
          </button>
          <button
            type="button"
            onClick={
              selectedExercise !== null && step === 'select' && analysis.state.phase === 'idle'
                ? handleContinue
                : undefined
            }
            disabled={
              !(selectedExercise !== null && step === 'select' && analysis.state.phase === 'idle')
            }
            className={[
              'transition-colors',
              analysis.state.phase !== 'idle' && analysis.state.phase !== 'error'
                ? 'text-muted'
                : step === 'video'
                ? 'font-medium text-secondary'
                : 'text-muted',
              selectedExercise !== null && step === 'select' && analysis.state.phase === 'idle'
                ? 'cursor-pointer hover:text-secondary'
                : 'cursor-default',
            ].join(' ')}
          >
            Enviar vídeo
          </button>
          <span className="flex-1 h-px bg-line ml-1" />
          <span
            className={[
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 transition-colors',
              analysis.state.phase === 'done'
                ? 'bg-success text-white'
                : analysis.state.phase === 'uploading' || analysis.state.phase === 'polling'
                ? 'bg-brand text-brand-fg'
                : 'border-2 border-line text-muted',
            ].join(' ')}
          >
            {analysis.state.phase === 'done' ? <Check className="w-3 h-3" /> : '3'}
          </span>
          <span
            className={[
              'transition-colors',
              analysis.state.phase === 'uploading' || analysis.state.phase === 'polling'
                ? 'font-medium text-secondary'
                : 'text-muted',
            ].join(' ')}
          >
            Resultado
          </span>
        </div>

        {/* Step 1: Exercise selection */}
        {step === 'select' && (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-fg">
                Qual exercício você vai realizar?
              </h2>
              <p className="text-muted">
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
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                  selectedExercise
                    ? 'bg-brand text-brand-fg hover:bg-brand/90 shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
                    : 'bg-raised text-muted cursor-not-allowed',
                ].join(' ')}
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* Step 2: Video input */}
        {selectedExercise !== null && (
          <div className={step === 'video' ? 'flex flex-col gap-6' : 'hidden'}>
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-fg">Grave ou envie o vídeo</h2>
              <p className="text-muted">
                Exercício selecionado:{' '}
                <span className="font-medium text-accent">
                  {EXERCISE_LABELS[selectedExercise]}
                </span>
              </p>
            </div>

            <VideoInput
              recorder={recorder}
              onVideoReady={handleVideoReady}
              disabled={analysis.state.phase !== 'idle'}
            />

            <div className="flex justify-start">
              <button
                type="button"
                onClick={handleBack}
                disabled={analysis.state.phase !== 'idle'}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted hover:text-secondary hover:bg-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            </div>
          </div>
        )}

        {/* Step 3a: Loading */}
        {(analysis.state.phase === 'uploading' || analysis.state.phase === 'polling') && (
          <AnalysisStatus phase={analysis.state.phase} />
        )}

        {/* Step 3b: Result */}
        {analysis.state.phase === 'done' && analysis.state.result !== null && (
          <AnalysisResult result={analysis.state.result} onReset={handleReset} />
        )}

        {/* Step 3c: Error */}
        {analysis.state.phase === 'error' && (
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-error-subtle px-6 py-8 text-center">
            <AlertCircle className="w-10 h-10 text-error" />
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold text-error">Erro na análise</p>
              <p className="text-sm text-error">{analysis.state.error}</p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-error text-white font-semibold text-sm hover:bg-error/90 transition-colors cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-muted">Pose Analyzer</footer>
    </div>
  );
}
