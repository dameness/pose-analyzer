import { useState, useEffect } from 'react';
import { AlertCircle, ArrowLeft, Check, ChevronRight, Moon, ScanLine, Sun } from 'lucide-react';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { VideoInput } from '../components/VideoInput';
import { AnalysisStatus } from '../components/AnalysisStatus';
import { AnalysisResult } from '../components/AnalysisResult';
import { useAnalysis } from '../hooks/useAnalysis';
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

  return { dark, toggle: () => setDark(d => !d) };
}

export function Home() {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType | null>(null);
  const [step, setStep] = useState<'select' | 'video'>('select');
  const analysis = useAnalysis();
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
    analysis.reset();
    setStep('select');
  }

  function handleReset() {
    analysis.reset();
    // step stays 'video' — VideoInput re-enables and user can resubmit
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <ScanLine className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
              Pose Analyzer
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Análise postural com IA
            </p>
          </div>
          <button
            type="button"
            onClick={toggleDark}
            aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            className={[
              'relative w-14 h-7 rounded-full transition-colors duration-300 cursor-pointer shrink-0',
              dark ? 'bg-indigo-600' : 'bg-gray-300',
            ].join(' ')}
          >
            <span className={[
              'absolute top-1 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center transition-all duration-300',
              dark ? 'left-8' : 'left-1',
            ].join(' ')}>
              {dark ? <Moon className="w-3 h-3 text-indigo-600" /> : <Sun className="w-3 h-3 text-gray-400" />}
            </span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          {/* Step 1 — clicável quando estiver no step 2 e análise idle */}
          <button
            type="button"
            onClick={step === 'video' && analysis.state.phase === 'idle' ? handleBack : undefined}
            disabled={!(step === 'video' && analysis.state.phase === 'idle')}
            className={[
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 transition-colors',
              step === 'select' ? 'bg-indigo-600 text-white' : 'bg-green-500 text-white',
              step === 'video' && analysis.state.phase === 'idle'
                ? 'cursor-pointer hover:ring-2 hover:ring-green-400 hover:ring-offset-1'
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
              step === 'select' ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500',
              step === 'video' && analysis.state.phase === 'idle'
                ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-300'
                : 'cursor-default',
            ].join(' ')}
          >
            Escolha o exercício
          </button>
          <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-1" />
          {/* Step 2 — clicável quando exercício selecionado, estiver no step 1 e análise idle */}
          <button
            type="button"
            onClick={selectedExercise !== null && step === 'select' && analysis.state.phase === 'idle' ? handleContinue : undefined}
            disabled={!(selectedExercise !== null && step === 'select' && analysis.state.phase === 'idle')}
            className={[
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 transition-colors',
              analysis.state.phase !== 'idle' && analysis.state.phase !== 'error'
                ? 'bg-green-500 text-white'
                : step === 'video'
                  ? 'bg-indigo-600 text-white'
                  : 'border-2 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500',
              selectedExercise !== null && step === 'select' && analysis.state.phase === 'idle'
                ? 'cursor-pointer hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-400 dark:hover:text-indigo-400'
                : 'cursor-default',
            ].join(' ')}
          >
            {analysis.state.phase !== 'idle' && analysis.state.phase !== 'error' ? <Check className="w-3 h-3" /> : '2'}
          </button>
          <button
            type="button"
            onClick={selectedExercise !== null && step === 'select' && analysis.state.phase === 'idle' ? handleContinue : undefined}
            disabled={!(selectedExercise !== null && step === 'select' && analysis.state.phase === 'idle')}
            className={[
              'transition-colors',
              analysis.state.phase !== 'idle' && analysis.state.phase !== 'error'
                ? 'text-gray-400 dark:text-gray-500'
                : step === 'video'
                  ? 'font-medium text-gray-700 dark:text-gray-300'
                  : 'text-gray-400 dark:text-gray-500',
              selectedExercise !== null && step === 'select' && analysis.state.phase === 'idle'
                ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-300'
                : 'cursor-default',
            ].join(' ')}
          >
            Enviar vídeo
          </button>
          <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-1" />
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
                : 'text-gray-400 dark:text-gray-500',
            ].join(' ')}
          >
            Resultado
          </span>
        </div>

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
                <span className="font-medium text-indigo-600 dark:text-indigo-400">
                  {EXERCISE_LABELS[selectedExercise]}
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

        {/* Step 3a: Loading */}
        {(analysis.state.phase === 'uploading' || analysis.state.phase === 'polling') && (
          <AnalysisStatus phase={analysis.state.phase} />
        )}

        {/* Step 3b: Result */}
        {analysis.state.phase === 'done' && analysis.state.result !== null && (
          <AnalysisResult
            result={analysis.state.result}
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
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-gray-400 dark:text-gray-600">
        TCC — Bacharelado em Ciência da Computação · IFSul Câmpus Passo Fundo
      </footer>
    </div>
  );
}
