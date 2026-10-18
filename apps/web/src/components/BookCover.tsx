import clsx from 'clsx';
import { Fragment } from 'react';

// Decorative, generated book jacket. Colour is derived from the book id so every
// book keeps the same cover between visits; the real cover is not in the dataset.
const JACKETS = [
  'from-[#1b4f72] to-[#0b2233]',
  'from-[#2f6b4f] to-[#173a2a]',
  'from-[#7a3b47] to-[#3d1c23]',
  'from-[#a5622b] to-[#5a3214]',
  'from-[#2c6a76] to-[#133238]',
  'from-[#4a4a68] to-[#23233a]',
];

function jacketFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return JACKETS[hash % JACKETS.length];
}

/** Small jacket for list rows: same colour as the book's full cover, no text. */
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
  // Allow line breaks after "+", "/" and "&" so titles like "Ctrl+Alt+Delete" wrap at natural points.
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
