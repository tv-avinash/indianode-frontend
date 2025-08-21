export default function StoragePage() {
  const base = process.env.NEXT_PUBLIC_DEPLOYER_BASE || "";
  return (
    <main className="mx-auto max-w-3xl p-6 leading-7">
      <h1 className="text-3xl font-semibold mb-4">Local NVMe Storage for Your Akash Lease</h1>
      <p>Fast same-host storage for checkpoints, HF snapshots, and preprocessed data. No extra setup on your side.</p>

      {!base && (
        <p style={{background:'#fff3cd', border:'1px solid #ffeeba', padding:'8px', borderRadius:6, marginTop:16}}>
          <b>Heads up:</b> set <code>NEXT_PUBLIC_DEPLOYER_BASE</code> in Vercel to your backend URL (e.g. <code>https://your-render.onrender.com</code>).
        </p>
      )}

      <h2 className="text-xl font-semibold mt-8">Scratch (included)</h2>
      <ul className="list-disc pl-6">
        <li><b>Basic</b>: 50 Gi included → upgrade to 200 Gi (+₹299/mo)</li>
        <li><b>Pro</b>: 200 Gi included → upgrade to 500 Gi (+₹599/mo)</li>
        <li><b>Max</b>: 500 Gi included → upgrade to 1 TiB (+₹1,199/mo)</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8">Dataset Cache (persistent)</h2>
      <ul className="list-disc pl-6">
        <li>200 Gi — ₹399/mo</li>
        <li>500 Gi — ₹799/mo</li>
        <li>1 TiB — ₹1,499/mo</li>
      </ul>
      <p className="mt-2 text-sm opacity-80">Request the size you want in your SDL. Volume mounts at <code>/data</code>. Keep ~10–15% free space.</p>

      <h2 className="text-xl font-semibold mt-8">Download SDL Templates</h2>
      <ul className="list-disc pl-6">
        <li><a href="/downloads/sdl/app-200Gi.yaml" className="text-blue-600 underline">GPU + 200 Gi</a></li>
        <li><a href="/downloads/sdl/app-500Gi.yaml" className="text-blue-600 underline">GPU + 500 Gi</a></li>
        <li><a href="/downloads/sdl/app-1Ti.yaml" className="text-blue-600 underline">GPU + 1 TiB</a></li>
        <li><a href="/downloads/sdl/storage-only-1Ti.yaml" className="text-blue-600 underline">Storage-only 1 TiB</a></li>
      </ul>

      <h2 className="text-xl font-semibold mt-8">Self-serve Data Preload</h2>
      <p>Run this inside your container to populate <code>/data</code>:</p>
      <pre className="bg-gray-100 p-3 rounded-md overflow-auto"><code>curl -fsSL {`${base || "https://your-backend.example.com"}/storage/preload.sh`} | bash</code></pre>

      <h3 className="text-lg font-semibold mt-6">Direct download</h3>
      <p><a href="/downloads/scripts/preload.sh" className="text-blue-600 underline">preload.sh</a></p>

      <h2 className="text-xl font-semibold mt-8">How to Use on Akash</h2>
      <ol className="list-decimal pl-6">
        <li>Pick a GPU plan and choose 200 Gi / 500 Gi / 1 TiB dataset cache.</li>
        <li>Use one of our SDLs above and deploy.</li>
        <li>After the lease starts, open a shell in your container, then run the preload script.</li>
      </ol>
    </main>
  );
}
