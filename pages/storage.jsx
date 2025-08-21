// pages/storage.jsx

export default function StoragePage() {
  // ----- Pricing (edit INR if you change prices) -----
  const PRICE = { g200: 399, g500: 799, g1tb: 1499, preload: 499 };

  // ----- USD display (override with NEXT_PUBLIC_USD_INR on Vercel) -----
  const USD_INR =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_USD_INR
      ? Number(process.env.NEXT_PUBLIC_USD_INR)
      : 87;
  const toUSD = (inr) => (inr / USD_INR).toFixed(2);

  // ----- Capacity switch: set NEXT_PUBLIC_SALES_OPEN=0 when GPU is busy -----
  const SALES_OPEN =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_SALES_OPEN
      ? process.env.NEXT_PUBLIC_SALES_OPEN !== "0"
      : true; // default: open

  // ----- Preload script endpoint: backend if set, else static file -----
  const base = process.env.NEXT_PUBLIC_DEPLOYER_BASE || "";
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://www.indianode.com";
  const preloadUrl = base
    ? `${base.replace(/\/+$/, "")}/storage/preload.sh`
    : `${origin}/downloads/scripts/preload.sh`;

  // ----- Clean any accidental double-prefix in Razorpay URLs -----
  const cleanRzp = (u) =>
    (u || "")
      .trim()
      .replace(/^https?:\/\/rzp\.io\/(https?:\/\/rzp\.io\/)+/i, "https://rzp.io/");

  // ----- Razorpay links from Vercel env (single source of truth) -----
  const LINKS = {
    g200: cleanRzp(process.env.NEXT_PUBLIC_RZP_200_MULTI || ""),
    g500: cleanRzp(process.env.NEXT_PUBLIC_RZP_500_MULTI || ""),
    g1tb: cleanRzp(process.env.NEXT_PUBLIC_RZP_1TB_MULTI || ""),
    preload: cleanRzp(process.env.NEXT_PUBLIC_RZP_PRELOAD_MULTI || ""),
  };

  const BuyButton = ({ href, children }) =>
    SALES_OPEN && href ? (
      <a className="btn" href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ) : SALES_OPEN && !href ? (
      <button className="btn disabled" disabled>
        Set link in Vercel
      </button>
    ) : (
      <div className="muted">Out of stock — GPU currently busy</div>
    );

  const PlanCard = ({ title, desc, inr, href }) => (
    <div className="card">
      <h3>{title}</h3>
      <p className="muted">{desc}</p>
      <div className="price">
        ₹{inr} <span className="usd">~${toUSD(inr)}/mo</span>
      </div>
      <BuyButton href={href}>Buy now</BuyButton>
    </div>
  );

  return (
    <main>
      {/* Status banner */}
      {!SALES_OPEN && (
        <div className="banner">
          <strong>At capacity:</strong> our GPU is currently leased. Buy buttons are disabled. Please check
          back soon.
        </div>
      )}

      {/* Hero */}
      <section className="hero">
        <h1>Local NVMe Storage for Your Akash Lease</h1>
        <p>
          Fast, same-host storage for checkpoints, HuggingFace snapshots, and preprocessed data. Zero server
          changes on your side.
        </p>
      </section>

      {/* Plans */}
      <section>
        <h2>Dataset Cache (persistent volume)</h2>
        <div className="grid">
          <PlanCard
            title="200 Gi"
            desc="Great for checkpoints & HF snapshots"
            inr={PRICE.g200}
            href={LINKS.g200}
          />
          <PlanCard
            title="500 Gi"
            desc="Roomy training & fine-tuning cache"
            inr={PRICE.g500}
            href={LINKS.g500}
          />
          <PlanCard
            title="1 TiB"
            desc="Big datasets & multi-model workflows"
            inr={PRICE.g1tb}
            href={LINKS.g1tb}
          />
        </div>

        <p className="tip">
          Request the size you want in your SDL. The volume is mounted at <code>/data</code>. Keep ~10–15%
          free space for safety.
        </p>
      </section>

      {/* Preload add-on */}
      <section>
        <div className="card preload">
          <div>
            <h3>Self-serve Preload (one-time)</h3>
            <p className="muted">
              Script to pull popular models/datasets into <code>/data</code>.
            </p>
          </div>
          <div className="price">
            ₹{PRICE.preload} <span className="usd">~${toUSD(PRICE.preload)}</span>
          </div>
          <BuyButton href={LINKS.preload}>Buy preload</BuyButton>
        </div>

        <p className="muted" style={{ marginTop: 10 }}>
          Run inside your container after purchase:
        </p>
        <pre className="code">
          <code>{`curl -fsSL ${preloadUrl} | bash`}</code>
        </pre>
        <p className="muted">
          Or download: <a href="/downloads/scripts/preload.sh">preload.sh</a>
        </p>
      </section>

      {/* SDL downloads */}
      <section>
        <h2>Download SDL Templates</h2>
        <ul className="links">
          <li><a href="/downloads/sdl/app-200Gi.yaml">GPU + 200 Gi</a></li>
          <li><a href="/downloads/sdl/app-500Gi.yaml">GPU + 500 Gi</a></li>
          <li><a href="/downloads/sdl/app-1Ti.yaml">GPU + 1 TiB</a></li>
          <li><a href="/downloads/sdl/storage-only-1Ti.yaml">Storage-only 1 TiB</a></li>
        </ul>
      </section>

      {/* How it works — deploy → pay → preload */}
      <section>
        <h2>How it works</h2>
        <ol className="steps">
          <li>
            <strong>Deploy on Indianode</strong> using an SDL that requests 200 Gi / 500 Gi / 1 TiB dataset cache.
          </li>
          <li>
            <strong>Pay</strong> for the matching size using the button above (cards/UPI supported).
          </li>
          <li>
            <strong>Preload (optional)</strong> — open a shell and run the one-liner to fetch models/datasets.
          </li>
        </ol>
      </section>

      {/* Notes */}
      <section className="notes">
        <h3>Notes</h3>
        <ul>
          <li>Data lives on a local persistent volume at <code>/data</code> and is removed when the lease ends.</li>
          <li>No backups / No SLA — keep your own copies.</li>
          <li>Large downloads may incur egress from the source; manage responsibly.</li>
        </ul>
      </section>

      {/* Styles */}
      <style jsx>{`
        main {
          max-width: 980px;
          margin: 0 auto;
          padding: 28px 20px 60px;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial,
            "Apple Color Emoji", "Segoe UI Emoji";
          color: #0f172a;
        }
        .banner {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #9a3412;
          padding: 10px 14px;
          border-radius: 12px;
          margin-bottom: 14px;
        }
        .hero {
          background: radial-gradient(1200px 400px at 10% -10%, #e6f0ff, transparent),
            radial-gradient(800px 300px at 90% -20%, #f5e8ff, transparent);
          border: 1px solid #eef2ff;
          border-radius: 18px;
          padding: 28px;
          margin-bottom: 22px;
          box-shadow: 0 1px 12px rgba(16, 24, 40, 0.04);
        }
        h1 {
          font-size: 30px;
          margin: 0 0 8px;
        }
        h2 {
          font-size: 22px;
          margin: 26px 0 12px;
        }
        h3 {
          font-size: 18px;
          margin: 0 0 6px;
        }
        .muted {
          color: #475569;
        }
        .tip {
          color: #475569;
          margin-top: 10px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 860px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
        .card {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px;
          background: #fff;
          box-shadow: 0 1px 8px rgba(2, 6, 23, 0.04);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .card:hover {
          box-shadow: 0 10px 24px rgba(2, 6, 23, 0.08);
          transform: translateY(-2px);
          transition: all 160ms ease;
        }
        .preload {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 14px;
        }
        .price {
          font-weight: 700;
          font-size: 22px;
        }
        .usd {
          font-weight: 500;
          font-size: 14px;
          color: #64748b;
          margin-left: 8px;
        }
        .btn {
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 10px 14px;
          text-decoration: none;
          text-align: center;
          cursor: pointer;
          transition: background 120ms ease, transform 120ms ease;
        }
        .btn:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
        }
        .btn.disabled {
          background: #cbd5e1;
          cursor: not-allowed;
        }
        .code {
          background: #0b1020;
          color: #e2e8f0;
          border-radius: 12px;
          padding: 12px;
          overflow-x: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
            "Courier New", monospace;
          font-size: 14px;
        }
        .links li {
          margin: 6px 0;
        }
        .steps li {
          margin: 6px 0;
        }
        .notes {
          margin-top: 24px;
          border-top: 1px dashed #e2e8f0;
          padding-top: 16px;
        }
      `}</style>
    </main>
  );
}
