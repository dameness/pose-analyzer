import { AlertTriangle, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { buildVideoUrl } from '../services/api';
import type { AnalysisResultProps } from '../types';
import { AngleChart } from './AngleChart';
import { JointFeedback } from './JointFeedback';

const NOME_ARTICULACAO: Record<string, string> = {
  knee: 'joelho',
  hip: 'quadril',
  ankle: 'tornozelo',
  elbow: 'cotovelo',
  shoulder: 'ombro',
  spine: 'coluna',
};

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
          correct ? 'bg-success-subtle' : 'bg-error-subtle',
        ].join(' ')}
      >
        {correct ? (
          <CheckCircle2 className="w-10 h-10 text-success" />
        ) : (
          <XCircle className="w-10 h-10 text-error" />
        )}
        <p className={['text-xl font-bold', correct ? 'text-success' : 'text-error'].join(' ')}>
          {correct ? 'Execução Correta' : 'Execução Incorreta'}
        </p>
        <p className="text-sm text-muted">
          {confidence}% de confiança · {result.frames_analyzed} frames analisados
        </p>
      </div>

      {/* 2. Joint grid */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">
          Articulações
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {joints.map((joint) => (
            <JointFeedback
              key={joint}
              joint={NOME_ARTICULACAO[joint] ?? joint}
              correct={result.joint_results[joint] === 'correct'}
            />
          ))}
        </div>
      </div>

      {/* 3. Error list */}
      {result.errors.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">
            Erros detectados
          </h3>
          <div className="flex gap-3 rounded-2xl bg-warning-subtle px-4 py-4">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <ul className="flex flex-col gap-1">
              {result.errors.map((error, i) => (
                <li key={i} className="text-sm text-warning">
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
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">
            Ângulos por frame
          </h3>
          <div className="rounded-2xl bg-surface border border-line p-4">
            <AngleChart jointAngles={result.joint_angles} />
          </div>
        </div>
      )}

      {/* 5. Vídeo anotado */}
      {result.video_url &&
        (() => {
          const videoSrc = buildVideoUrl(result.video_url);
          return (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">
                Vídeo anotado
              </h3>
              <div className="rounded-2xl overflow-hidden border border-line">
                <video src={videoSrc} controls className="w-full" />
              </div>
              <div className="flex justify-center">
                <a
                  href={videoSrc}
                  download="video_anotado.mp4"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-line text-sm font-medium text-fg hover:bg-subtle transition-colors"
                >
                  Baixar vídeo anotado
                </a>
              </div>
            </div>
          );
        })()}

      {/* 6. Reset button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand text-brand-fg font-semibold text-sm hover:bg-brand/90 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <RotateCcw className="w-4 h-4" />
          Analisar novamente
        </button>
      </div>
    </div>
  );
}
