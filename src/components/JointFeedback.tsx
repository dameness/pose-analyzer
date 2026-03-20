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
