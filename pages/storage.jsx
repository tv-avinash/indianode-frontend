// pages/storage.js

export default function StoragePage() {
  // If you set NEXT_PUBLIC_DEPLOYER_BASE in Vercel, we’ll use your backend.
  // Otherwise we fall back to the static script under /public/downloads/scripts/preload.sh
  const base = process.env.NEXT_PUBLIC_DEPLOYER_BASE || "";
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://www.indianode.com"; // fallback for SSR
  const preloadUrl = base
    ? `${base.replace(/\/+$/, "")}/storage/preload.sh`
    : `${origin}/downloads/scripts/preload.sh`;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
        Local NVMe Storage for Your Akash Lease
      </h1>
      <p>
        Fast same-host storage for checkpoints, HuggingFace snapshots, and preprocessed data. No extra setup
        on your side.
      </p>

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
      <p style={{ opacity: 0.85 }}>
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

      <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 20 }}>Direct download</h3>
      <p>
        <a href="/downloads/scripts/preload.sh">preload.sh</a>
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 28 }}>How to Use on Akash</h2>
      <ol>
        <li>Pick a GPU plan and choose 200 Gi / 500 Gi / 1 TiB dataset cache.</li>
        <li>Use one of our SDLs above and deploy.</li>
        <li>After the lease starts, open a shell in your container, then run the preload script.</li>
      </ol>
    </main>
  );
}
