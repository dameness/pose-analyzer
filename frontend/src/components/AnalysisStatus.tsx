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
