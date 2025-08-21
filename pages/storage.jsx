// pages/storage.js

export default function StoragePage() {
  // --- Pricing (INR) ---
  const PRICE = {
    g200: 399,
    g500: 799,
    g1tb: 1499,
    preload: 499,
  };

  // --- Currency (configure via Vercel env if you like) ---
  const USD_INR =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_USD_INR
      ? Number(process.env.NEXT_PUBLIC_USD_INR)
      : 87; // fallback FX rate
  const usd = (inr) => (inr / USD_INR).toFixed(2);

  // --- Script endpoint: backend if set, else static file on this domain ---
  const base = process.env.NEXT_PUBLIC_DEPLOYER_BASE || "";
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://www.indianode.com";
  const preloadUrl = base
    ? `${base.replace(/\/+$/, "")}/storage/preload.sh`
    : `${origin}/downloads/scripts/preload.sh`;

  // --- Razorpay Payment Links ---
  // UPI-only (you already created these)
  const LINKS_UPI = {
    g200: "https://rzp.io/rzp/CyxR4B6b",
    g500: "https://rzp.io/rzp/BOliiR2I",
    g1tb: "https://rzp.io/rzp/X7XidcwY",
    preload: "https://rzp.io/rzp/EQpOkv2",
  };

  // Multi-mode (cards/UPI/wallets; paste your new Razorpay Payment Link URLs here)
  const LINKS_MULTI = {
    g200: "https://rzp.io/rzp/PASTE_200_MULTI",     // <-- replace
    g500: "https://rzp.io/rzp/PASTE_500_MULTI",     // <-- replace
    g1tb: "https://rzp.io/rzp/PASTE_1TB_MULTI",     // <-- replace
    preload: "https://rzp.io/rzp/PASTE_PRELOAD_MULTI", // <-- replace
  };

  // Optional direct UPI intent (backup). Replace YOURUPI@bank if you want to show it.
  const UPI_INTENT = {
    g200: "upi://pay?pa=YOURUPI@bank&pn=Indianode&am=399&cu=INR&tn=Dataset%20Cache%20200Gi",
    g500: "upi://pay?pa=YOURUPI@bank&pn=Indianode&am=799&cu=INR&tn=Dataset%20Cache%20500Gi",
    g1tb: "upi://pay?pa=YOURUPI@bank&pn=Indianode&am=1499&cu=INR&tn=Dataset%20Cache%201TiB",
    preload: "upi://pay?pa=YOURUPI@bank&pn=Indianode&am=499&cu=INR&tn=Self-serve%20Preload",
  };

  const btn = (href, label) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        padding: "10px 14px",
        border: "1px solid #ddd",
        borderRadius: 8,
        display: "inline-block",
      }}
    >
      {label}
    </a>
  );

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
        Local NVMe Storage for Your Akash Lease
      </h1>
      <p>Fast same-host storage for checkpoints, HuggingFace snapshots, and preprocessed data.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 28 }}>Scratch (included)</h2>
      <ul>
        <li><b>Basic</b>: 50 Gi included → upgrade to 200 Gi (+₹{PRICE.g200})</li>
        <li><b>Pro</b>: 200 Gi included → upgrade to 500 Gi (+₹{PRICE.g500})</li>
        <li><b>Max</b>: 500 Gi included → upgrade to 1 TiB (+₹{PRICE.g1tb})</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 28 }}>Dataset Cache (persistent)</h2>
      <ul>
        <li>200 Gi — ₹{PRICE.g200} (~${usd(PRICE.g200)}/mo)</li>
        <li>500 Gi — ₹{PRICE.g500} (~${usd(PRICE.g500)}/mo)</li>
        <li>1 TiB — ₹{PRICE.g1tb} (~${usd(PRICE.g1tb)}/mo)</li>
      </ul>

      {/* BUY BUTTONS — UPI-only */}
      <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 12 }}>Pay via UPI (India)</h3>
      <div style={{ display: "grid", gap: 10, marginBottom: 4 }}>
        {btn(LINKS_UPI.g200, `Buy 200 Gi — ₹${PRICE.g200} (~$${usd(PRICE.g200)}/mo)`)}
        {btn(LINKS_UPI.g500, `Buy 500 Gi — ₹${PRICE.g500} (~$${usd(PRICE.g500)}/mo)`)}
        {btn(LINKS_UPI.g1tb, `Buy 1 TiB — ₹${PRICE.g1tb} (~$${usd(PRICE.g1tb)}/mo)`)}
      </div>
      <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 16 }}>
        Prefer a direct UPI app?{" "}
        <a href={UPI_INTENT.g500}>UPI intent (example for 500 Gi)</a>
      </div>

      {/* BUY BUTTONS — MULTI-MODE */}
      <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 10 }}>
        Pay with Cards / UPI / Wallets (Global)
      </h3>
      <div style={{ display: "grid", gap: 10 }}>
        {btn(LINKS_MULTI.g200, `Buy 200 Gi — ₹${PRICE.g200} (~$${usd(PRICE.g200)}/mo)`)}
        {btn(LINKS_MULTI.g500, `Buy 500 Gi — ₹${PRICE.g500} (~$${usd(PRICE.g500)}/mo)`)}
        {btn(LINKS_MULTI.g1tb, `Buy 1 TiB — ₹${PRICE.g1tb} (~$${usd(PRICE.g1tb)}/mo)`)}
      </div>

      <p style={{ opacity: 0.85, marginTop: 8 }}>
        Request the size you want in your SDL. Volume mounts at <code>/data</code>. Keep ~10–15% free space.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 28 }}>Download SDL Templates</h2>
      <ul>
        <li><a href="/downloads/sdl/app-200Gi.yaml">GPU + 200 Gi</a></li>
        <li><a href="/downloads/sdl/app-500Gi.yaml">GPU + 500 Gi</a></li>
        <li><a href="/downloads/sdl/app-1Ti.yaml">GPU + 1 TiB</a></li>
        <li><a href="/downloads/sdl/storage-only-1Ti.yaml">Storage-only 1 TiB</a></li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 28 }}>Self-serve Data Preload</h2>
      <p>
        One-time add-on to pull common models/datasets into <code>/data</code> using our script.
        Price: ₹{PRICE.preload} (~${usd(PRICE.preload)})
      </p>

      {/* Preload buy buttons */}
      <div style={{ display: "grid", gap: 10, marginTop: 6 }}>
        {btn(LINKS_UPI.preload, `Buy Preload (UPI) — ₹${PRICE.preload} (~$${usd(PRICE.preload)})`)}
        {btn(LINKS_MULTI.preload, `Buy Preload (Cards/UPI) — ₹${PRICE.preload} (~$${usd(PRICE.preload)})`)}
      </div>

      <p style={{ marginTop: 10 }}>Run this inside your container to populate <code>/data</code>:</p>
      <pre style={{ background: "#f3f4f6", padding: 12, borderRadius: 8, overflow: "auto" }}>
        <code>{`curl -fsSL ${preloadUrl} | bash`}</code>
      </pre>

      <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 16 }}>Direct download</h3>
      <p><a href="/downloads/scripts/preload.sh">preload.sh</a></p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 28 }}>After payment</h2>
      <ol>
        <li>Deploy using an SDL with <code>storage.size</code> set to 200 Gi / 500 Gi / 1 TiB (templates above).</li>
        <li>Send your payment ID + Akash deployment ID to us for activation:</li>
      </ol>
      <p>
        <a
          href={`mailto:support@indianode.com?subject=Storage%20Add-on%20Activation&body=Hi%2C%0A%0APayment%20ID%20(or%20UTR)%3A%20%0AAkash%20Deployment%20ID%3A%20%0ARequested%20Size%3A%20200Gi%20%2F%20500Gi%20%2F%201TiB%0A%0AThanks!`}
          style={{ color: "#2563eb", textDecoration: "underline" }}
        >
          Email payment details for activation
        </a>
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 28 }}>Notes</h2>
      <ul>
        <li>Data lives on a local persistent volume at <code>/data</code> and is removed when the lease ends.</li>
        <li>No backups / No SLA; keep your own copies.</li>
        <li>Large downloads may incur egress from the source; manage responsibly.</li>
      </ul>
    </main>
  );
}
