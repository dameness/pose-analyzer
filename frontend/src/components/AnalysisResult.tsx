import { CheckCircle2, XCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import type { AnalysisResultProps } from '../types';
import { JointFeedback } from './JointFeedback';
import { AngleChart } from './AngleChart';

export function AnalysisResult({ result, onReset }: AnalysisResultProps) {
  const correct = result.result === 'correct';
  const joints = Object.keys(result.joint_results);
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
              correct={result.joint_results[joint] === 'correct'}
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
