import clsx from 'clsx';
import { Fragment } from 'react';

const JACKETS = [
  'from-[#1b4f72] to-[#0d263a]',
  'from-[#2e86c1] to-[#1b4f72]',
  'from-[#117864] to-[#0b4f42]',
  'from-[#5d6d7e] to-[#2e4053]',
  'from-[#21618c] to-[#123349]',
  'from-[#7d6608] to-[#4a3c05]',
];

function jacketFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return JACKETS[hash % JACKETS.length];
}

export function MiniCover({ id }: { id: string | null }) {
  return (
    <span
      aria-hidden
      className={clsx(
        'relative block h-12 w-8 shrink-0 overflow-hidden rounded-[3px] bg-gradient-to-br shadow-[2px_3px_6px_-2px_rgb(27_26_22/0.4)]',
        id ? jacketFor(id) : 'from-slate-300 to-slate-400',
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-black/20" />
    </span>
  );
}

export function BookCover({ id, title, genre, className }: { id: string; title: string; genre: string; className?: string }) {
  const parts = title.split(/(?<=[+/&])/);
  return (
    <div
      aria-hidden
      className={clsx(
        'relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-md bg-gradient-to-br p-3 text-white shadow-[4px_6px_14px_-4px_rgb(27_26_22/0.45)]',
        jacketFor(id),
        className,
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 bg-black/20" />
      <span className="truncate pl-1 text-[9px] font-semibold tracking-[0.14em] text-white/70 uppercase">{genre.split('/')[0]}</span>
      <span className="line-clamp-4 pl-1 font-display text-[13px] leading-tight font-semibold [overflow-wrap:anywhere] sm:text-[15px]">
        {parts.map((part, i) => (
          <Fragment key={i}>
            {i > 0 && <wbr />}
            {part}
          </Fragment>
        ))}
      </span>
      <span className="pl-1 text-[8px] tracking-[0.2em] text-white/60 uppercase">BookLeaf</span>
    </div>
  );
}
