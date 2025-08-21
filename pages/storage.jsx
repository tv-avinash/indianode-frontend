// pages/storage.js

export default function StoragePage() {
  // If NEXT_PUBLIC_DEPLOYER_BASE is set on Vercel, use backend endpoint.
  // Otherwise fall back to the static script under /public/downloads/scripts/preload.sh
  const base = process.env.NEXT_PUBLIC_DEPLOYER_BASE || "";
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://www.indianode.com";
  const preloadUrl = base
    ? `${base.replace(/\/+$/, "")}/storage/preload.sh`
    : `${origin}/downloads/scripts/preload.sh`;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
        Local NVMe Storage for Your Akash Lease
      </h1>
      <p>Fast same-host storage for checkpoints, HuggingFace snapshots, and preprocessed data.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 28 }}>Scratch (included)</h2>
      <ul>
        <li><b>Basic</b>: 50 Gi included → upgrade to 200 Gi (+₹299/mo)</li>
        <li><b>Pro</b>: 200 Gi included → upgrade to 500 Gi (+₹599/mo)</li>
        <li><b>Max</b>: 500 Gi included → upgrade to 1 TiB (+₹1,199/mo)</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 28 }}>Dataset Cache (persistent)</h2>
      <ul>
        <li>200 Gi — ₹399/mo</li>
        <li>500 Gi — ₹799/mo</li>
        <li>1 TiB — ₹1,499/mo</li>
      </ul>

      {/* BUY BUTTONS (Razorpay Payment Links) */}
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <a href="https://rzp.io/rzp/CyxR4B6b" target="_blank" rel="noreferrer"
           style={{ padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, display: "inline-block" }}>
          Buy 200 Gi — ₹399 / month
        </a>
        <a href="https://rzp.io/rzp/BOliiR2I" target="_blank" rel="noreferrer"
           style={{ padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, display: "inline-block" }}>
          Buy 500 Gi — ₹799 / month
        </a>
        <a href="https://rzp.io/rzp/X7XidcwY" target="_blank" rel="noreferrer"
           style={{ padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, display: "inline-block" }}>
          Buy 1 TiB — ₹1,499 / month
        </a>
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
      <p>Run this inside your container to populate <code>/data</code>:</p>
      <pre style={{ background: "#f3f4f6", padding: 12, borderRadius: 8, overflow: "auto" }}>
        <code>{`curl -fsSL ${preloadUrl} | bash`}</code>
      </pre>

      <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 16 }}>Direct download</h3>
      <p><a href="/downloads/scripts/preload.sh">preload.sh</a></p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 28 }}>Self-serve Preload (one-time)</h2>
      <p>
        <a href="https://rzp.io/rzp/EQpOkv2" target="_blank" rel="noreferrer"
           style={{ padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, display: "inline-block" }}>
          Buy Preload — ₹499 (one-time)
        </a>
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 28 }}>After payment</h2>
      <ol>
        <li>Deploy using an SDL with <code>storage.size</code> set to 200 Gi / 500 Gi / 1 TiB (templates above).</li>
        <li>Send your payment ID + Akash deployment ID to us for activation:</li>
      </ol>
      <p>
        <a
          href={`mailto:support@indianode.com?subject=Storage%20Add-on%20Activation&body=Hi%2C%0A%0APayment%20Link%20ID%20(or%20UTR)%3A%20%0AAkash%20Deployment%20ID%3A%20%0ARequested%20Size%3A%20200Gi%20%2F%20500Gi%20%2F%201TiB%0A%0AThanks!`}
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
