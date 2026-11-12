'use client';

import { useEffect, useRef } from 'react';

/** A sheet of paper laid over the desk. Closes on Escape or a click outside. */
export default function Dialog({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    sheet.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="scrim fade" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`paper rise w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} p-5 outline-none sm:p-7`}
      >
        <div className="rule mb-4 flex items-start justify-between gap-4 pb-3">
          <h2 className="typed text-xl leading-tight sm:text-2xl">{title}</h2>
          <button type="button" className="btn btn-line btn-sm shrink-0" onClick={onClose} aria-label="Close">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
