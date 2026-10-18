import clsx from 'clsx';
import { PRODUCTION_STAGES, type ProductionStage } from '@bookleaf/shared';

export function ProductionTracker({ stage }: { stage: ProductionStage }) {
  const current = PRODUCTION_STAGES.indexOf(stage);
  return (
    <div>
      <ol className="flex items-center gap-1" aria-label="Production progress">
        {PRODUCTION_STAGES.map((s, i) => (
          <li
            key={s}
            title={s}
            aria-current={i === current ? 'step' : undefined}
            className={clsx('h-1.5 flex-1 rounded-full', {
              'bg-leaf-500': i < current,
              'bg-brand-600 ring-2 ring-brand-200': i === current,
              'bg-slate-200': i > current,
            })}
          />
        ))}
      </ol>
      <p className="mt-2 text-xs text-slate-500">
        Step {current + 1} of {PRODUCTION_STAGES.length}: <span className="font-medium text-slate-700">{stage}</span>
        {current + 1 < PRODUCTION_STAGES.length && <> · next: {PRODUCTION_STAGES[current + 1]}</>}
      </p>
    </div>
  );
}
