// components/SiteChrome.jsx
import Link from "next/link";

/** Small inline logo that hints at “nodes + compute” */
function BrandMark({ className = "h-6 w-6" }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* node orbs */}
      <circle cx="12" cy="32" r="6" fill="#7C3AED" />
      <circle cx="52" cy="20" r="6" fill="#22D3EE" />
      <circle cx="44" cy="48" r="6" fill="#34D399" />
      {/* links */}
      <path
        d="M18 31.5L46 20M18 33l26 14"
        stroke="url(#g1)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="g1" x1="12" y1="20" x2="52" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22D3EE" />
          <stop offset="1" stopColor="#34D399" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function SiteChrome({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1220] via-[#0a1230] to-[#0b1220]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur">
        <div className="mx-auto max-w-7xl px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white">
            <BrandMark className="h-6 w-6" />
            <span className="font-bold tracking-wide">INDIANODE</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link
              href="/gpu"
              className="text-white/80 hover:text-white transition-colors"
            >
              GPU
            </Link>
            <Link
              href="/compute"
              className="text-white/80 hover:text-white transition-colors"
            >
              Compute
            </Link>
            <Link
              href="/storage"
              className="text-white/80 hover:text-white transition-colors"
            >
              Storage
            </Link>
            <Link
              href="/sdls"
              className="text-white/80 hover:text-white transition-colors"
            >
              SDLs
            </Link>
          </nav>
        </div>
      </header>

      {/* Page content (make sure text is dark INSIDE white cards) */}
      <main className="max-w-7xl mx-auto px-5 pb-14 text-gray-900">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-5 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2 text-white/80">
            <BrandMark className="h-5 w-5" />
            <span>© {new Date().getFullYear()} Indianode</span>
          </div>

          <div className="flex items-center gap-5">
            <Link href="/compute" className="text-white/70 hover:text-white">
              Compute
            </Link>
            <Link href="/storage" className="text-white/70 hover:text-white">
              Storage
            </Link>
            <Link href="/gpu" className="text-white/70 hover:text-white">
              GPU
            </Link>
            <Link href="/sdls" className="text-white/70 hover:text-white">
              SDLs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
