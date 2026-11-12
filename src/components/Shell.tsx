import Link from 'next/link';

/** Page chrome shared by the player-facing screens. */
export default function Shell({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pt-6 pb-5 sm:pt-8">
        <Link href="/" className="group block" aria-label="Shadowplay — today's case">
          <span className="wordmark block text-[1.7rem] leading-none sm:text-4xl">Shadowplay</span>
          <span className="label mt-2 block text-smoke group-hover:text-brass-hi">The daily silhouette case</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-2" aria-label="Main">
          {actions}
          <Link href="/archive" className="btn btn-ghost btn-sm">Case archive</Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-14">{children}</main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 pb-6 text-xs text-smoke/80">
        <span>One object. One shadow. Five guesses.</span>
        <Link href="/admin" className="hover:text-brass-hi">Records room</Link>
      </footer>
    </div>
  );
}
