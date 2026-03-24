import { Activity, Dumbbell, PersonStanding } from 'lucide-react';
import type { ExerciseSelectorProps, ExerciseType } from '../types';

interface ExerciseOption {
  value: ExerciseType;
  label: string;
  description: string;
  joints: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const EXERCISES: ExerciseOption[] = [
  {
    value: 'squat',
    label: 'Agachamento',
    description: 'Analisa a postura durante o agachamento livre',
    joints: 'Joelho · Quadril · Tornozelo',
    Icon: PersonStanding,
  },
  {
    value: 'situp',
    label: 'Abdominal',
    description: 'Avalia a execução do exercício abdominal',
    joints: 'Quadril · Coluna',
    Icon: Activity,
  },
  {
    value: 'pushup',
    label: 'Flexão',
    description: 'Verifica o alinhamento corporal na flexão de braços',
    joints: 'Cotovelo · Ombro · Quadril',
    Icon: Dumbbell,
  },
];

export function ExerciseSelector({ selected, onSelect }: ExerciseSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
      {EXERCISES.map(({ value, label, description, joints, Icon }) => {
        const isSelected = selected === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            aria-pressed={isSelected}
            className={[
              'relative flex flex-col items-center gap-4 rounded-2xl border-2 p-6 transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
              'hover:border-indigo-400 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer',
              isSelected
                ? 'border-indigo-500 bg-indigo-50 shadow-md dark:bg-indigo-950/40 dark:border-indigo-400'
                : 'border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/50',
            ].join(' ')}
          >
            <Icon
              className={[
                'w-12 h-12 transition-colors duration-200',
                isSelected
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400 dark:text-gray-500',
              ].join(' ')}
            />

            <div className="flex flex-col items-center gap-1 text-center">
              <span
                className={[
                  'text-lg font-semibold transition-colors duration-200',
                  isSelected
                    ? 'text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-800 dark:text-gray-100',
                ].join(' ')}
              >
                {label}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 leading-snug">
                {description}
              </span>
              <span
                className={[
                  'mt-1 text-xs font-medium px-2 py-0.5 rounded-full transition-colors duration-200',
                  isSelected
                    ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
                ].join(' ')}
              >
                {joints}
              </span>
            </div>

            {isSelected && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                >
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
