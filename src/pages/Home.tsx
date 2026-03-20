import { useState } from 'react';
import { ScanLine, ChevronRight } from 'lucide-react';
import { ExerciseSelector } from '../components/ExerciseSelector';
import type { ExerciseType } from '../types';

export function Home() {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType | null>(null);

  function handleContinue() {
    if (!selectedExercise) return;
    // Próxima etapa: upload/gravação de vídeo (a implementar)
    console.log('Exercício selecionado:', selectedExercise);
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
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-semibold shrink-0">
            1
          </span>
          <span className="font-medium text-gray-700 dark:text-gray-300">Escolha o exercício</span>
          <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-1" />
          <span className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-400 dark:text-gray-500 shrink-0">
            2
          </span>
          <span className="text-gray-400 dark:text-gray-500">Enviar vídeo</span>
          <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-1" />
          <span className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-400 dark:text-gray-500 shrink-0">
            3
          </span>
          <span className="text-gray-400 dark:text-gray-500">Resultado</span>
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Qual exercício você vai realizar?
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Selecione o exercício para que a IA possa analisar sua postura corretamente.
          </p>
        </div>

        {/* Exercise selector */}
        <ExerciseSelector selected={selectedExercise} onSelect={setSelectedExercise} />

        {/* Continue button */}
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
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-gray-400 dark:text-gray-600">
        TCC — Bacharelado em Ciência da Computação · IFSul Câmpus Passo Fundo
      </footer>
    </div>
  );
}
