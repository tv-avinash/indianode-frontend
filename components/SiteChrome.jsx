// components/SiteChrome.jsx
import Link from "next/link";

function Logo({ className = "h-7 w-7" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="12" r="5" fill="url(#g)" />
      <rect x="29" y="20" width="6" height="26" rx="3" fill="url(#g)" />
      <circle cx="14" cy="42" r="5" fill="#0ea5e9" />
      <circle cx="50" cy="42" r="5" fill="#8b5cf6" />
      <path d="M19 41 L29 35" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" />
      <path d="M45 41 L35 35" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function SiteChrome({ title, children, subtle = false }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* subtle gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-1/3 -left-1/3 h-[60rem] w-[60rem] rounded-full bg-cyan-500/10 blur-[140px]" />
        <div className="absolute -bottom-1/3 -right-1/3 h-[60rem] w-[60rem] rounded-full bg-indigo-500/10 blur-[140px]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo className="h-8 w-8" />
          <span className="text-lg font-bold tracking-wide">INDIANODE</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm text-white/80">
          <Link href="/gpu" className="hover:text-white">GPU</Link>
          <Link href="/compute" className="hover:text-white">Compute</Link>
          <Link href="/storage" className="hover:text-white">Storage</Link>
          <Link href="/sdls" className="hidden sm:inline hover:text-white">SDLs</Link>
        </nav>
      </header>

      <main className={`relative z-10 mx-auto ${subtle ? "max-w-5xl" : "max-w-6xl"} px-6 py-8`}>
        {title ? (
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {title}
            </h1>
          </div>
        ) : null}
        {children}
      </main>

      <footer className="relative z-10 mx-auto max-w-6xl px-6 pb-8 pt-2 text-center text-xs text-white/60">
        © {new Date().getFullYear()} Indianode
      </footer>
    </div>
  );
}
