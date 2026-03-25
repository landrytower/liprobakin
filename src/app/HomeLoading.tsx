import Image from "next/image";

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <header className="sticky top-0 live-pin-offset z-50 border-b border-cyan-900/40 bg-[#020715]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4 md:px-8">
          <div className="flex items-center gap-2 sm:gap-3 text-base sm:text-xl font-semibold tracking-[0.22em] sm:tracking-[0.3em] text-white">
            <Image
              src="/logos/liprobakin.png"
              alt="Liprobakin logo"
              width={34}
              height={34}
              className="h-8 w-8 rounded-full border border-cyan-500/30 object-cover"
              priority
            />
            <span className="hidden sm:inline">LIPROBAKIN</span>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-sm">Loading…</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-4 md:px-8">
        <section className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 sm:p-10">
          <div className="h-4 w-40 rounded bg-white/10" />
          <div className="mt-4 h-10 w-full max-w-xl rounded bg-white/10" />
          <div className="mt-3 h-5 w-full max-w-2xl rounded bg-white/10" />
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                <div className="h-5 w-32 rounded bg-white/10" />
                <div className="mt-4 h-24 w-full rounded bg-white/10" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
