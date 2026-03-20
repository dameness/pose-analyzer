import { useState } from 'react';
import { ArrowLeft, Check, ChevronRight, ScanLine } from 'lucide-react';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { VideoInput } from '../components/VideoInput';
import { useAnalysis } from '../hooks/useAnalysis';
import type { ExerciseType } from '../types';

const EXERCISE_LABELS: Record<ExerciseType, string> = {
  squat: 'Agachamento',
  situp: 'Abdominal',
  pushup: 'Flexão',
};

export function Home() {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType | null>(null);
  const [step, setStep] = useState<'select' | 'video'>('select');
  const analysis = useAnalysis();

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <ScanLine className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
              Pose Analyzer
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Análise postural com IA
            </p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-8">
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
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-gray-400 dark:text-gray-600">
        TCC — Bacharelado em Ciência da Computação · IFSul Câmpus Passo Fundo
      </footer>
    </div>
  );
}
