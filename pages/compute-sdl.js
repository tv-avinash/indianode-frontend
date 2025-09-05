// pages/compute-sdl.js
import Head from "next/head";
import { useState } from "react";

export default function ComputeSDLPage() {
  const [sdl, setSdl] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [email, setEmail] = useState("");

  // Optional params so the generated command is ready-to-run
  const [chainId, setChainId] = useState("akashnet-2");
  const [rpc, setRpc] = useState("https://rpc.akashnet.net:443");
  const [keyName, setKeyName] = useState("mykey");
  const [provider, setProvider] = useState("akash1................"); // put a default if you want

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const [token, setToken] = useState("");
  const [clientCmd, setClientCmd] = useState(""); // <-- this is what the client will copy
  const [step, setStep] = useState("form");

  function buildClientCommand({ sdlText, chainId, rpc, keyName, provider }) {
    // Safe heredoc with the raw SDL. No quoting issues.
    return `export AKASH_CHAIN_ID=\${AKASH_CHAIN_ID:-"${chainId}"} 
export AKASH_NODE=\${AKASH_NODE:-"${rpc}"}
export AKASH_KEY_NAME=\${AKASH_KEY_NAME:-"${keyName}"}
export AKASH_PROVIDER=\${AKASH_PROVIDER:-"${provider}"}

cat > deploy.yaml <<'YAML'
${sdlText}
YAML

akash tx deployment create deploy.yaml --from "$AKASH_KEY_NAME" --chain-id "$AKASH_CHAIN_ID" --node "$AKASH_NODE" --gas auto --gas-adjustment 1.5 -y

OWNER=$(akash keys show "$AKASH_KEY_NAME" -a)
DSEQ=$(akash query deployment list --owner "$OWNER" --node "$AKASH_NODE" --chain-id "$AKASH_CHAIN_ID" --output json | jq -r '.deployments[-1].deployment.deployment_id.dseq')
echo "DSEQ=$DSEQ"

akash provider send-manifest "$AKASH_PROVIDER" --dseq "$DSEQ" --gseq 1 --oseq 1 --node "$AKASH_NODE" --chain-id "$AKASH_CHAIN_ID" deploy.yaml

akash provider lease-status "$AKASH_PROVIDER" --dseq "$DSEQ" --gseq 1 --oseq 1 --node "$AKASH_NODE" --chain-id "$AKASH_CHAIN_ID"
`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      // 1) Create order
      const orderRes = await fetch("/api/compute/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: "generic", minutes: Number(minutes) || 60 }),
      });
      const order = await orderRes.json();
      if (!order?.ok) throw new Error("Order failed");

      // 2) Mint token
      const payId = order?.id || "free-dev";
      const mintRes = await fetch("/api/compute/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payId,
          sku: "generic",
          minutes: Number(minutes) || 60,
          email,
        }),
      });
      const mint = await mintRes.json();
      if (!mint?.ok || !mint?.token) throw new Error("Mint failed");
      setToken(mint.token);

      // 3) Redeem + queue with SDL payload
      const redeemRes = await fetch("/api/compute/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: mint.token,
          sdl,
          sdlName: "custom-sdl",
          sdlNotes: "submitted via /compute-sdl",
        }),
      });
      const redeem = await redeemRes.json();
      if (!redeem?.ok || !redeem?.queued) throw new Error("Redeem failed");
      setJobId(redeem.id);

      // 4) Build the client command immediately so user can copy & run from backend
      const cmd = buildClientCommand({
        sdlText: sdl,
        chainId,
        rpc,
        keyName,
        provider,
      });
      setClientCmd(cmd);
      setStep("ready");
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Deploy Custom SDL — Indianode</title>
        <meta
          name="description"
          content="Paste your own Akash SDL and deploy it using Indianode&#39;s compute queue. Also get a ready CLI command to run from your backend."
        />
        <link rel="canonical" href="https://www.indianode.com/compute-sdl" />
      </Head>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold mb-4">Deploy Custom SDL</h1>

        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-gray-700">
              Paste your Akash <code>.yaml</code> SDL below. After submit, we&#39;ll
              enqueue it and also generate a ready-to-run CLI command your client can copy & run from their backend.
            </p>

            <div>
              <label className="block font-medium mb-1">SDL (YAML)</label>
              <textarea
                className="w-full border rounded p-3 font-mono text-sm"
                rows={18}
                value={sdl}
                onChange={(e) => setSdl(e.target.value)}
                placeholder={"services:\\n  web:\\n    image: nginx:alpine\\n..."}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium mb-1">Minutes</label>
                <input
                  type="number"
                  min="1"
                  className="w-full border rounded p-2"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Notify Email (optional)</label>
                <input
                  type="email"
                  className="w-full border rounded p-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Optional: parameters to bake into the command */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block font-medium mb-1">Chain ID</label>
                <input
                  className="w-full border rounded p-2"
                  value={chainId}
                  onChange={(e) => setChainId(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-medium mb-1">RPC</label>
                <input
                  className="w-full border rounded p-2"
                  value={rpc}
                  onChange={(e) => setRpc(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Key Name</label>
                <input
                  className="w-full border rounded p-2"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block font-medium mb-1">Provider Address</label>
              <input
                className="w-full border rounded p-2"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="akash1..."
              />
              <p className="text-xs text-gray-600 mt-1">
                Use a provider that will bid for your SDL&#39;s attributes.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                disabled={busy || !sdl.trim()}
              >
                {busy ? "Submitting..." : "Submit & Get CLI"}
              </button>
              {error && <span className="text-red-600 text-sm">{error}</span>}
            </div>
          </form>
        )}

        {step === "ready" && (
          <div className="space-y-4">
            <div className="p-4 border rounded bg-green-50">
              <p className="font-medium">Queued!</p>
              <p className="text-sm mt-1">
                Job ID: <code>{jobId}</code>
              </p>
              <p className="text-sm mt-2">
                Token: <code className="break-all">{token}</code>
              </p>
              <p className="text-sm mt-3">
                Your worker will still pick this job (payload.kind = &#39;akash-sdl&#39;). Meanwhile, your client can deploy immediately using the CLI below.
              </p>
            </div>

            <div>
              <h2 className="font-semibold mb-2">Client CLI (copy & run)</h2>
              <textarea
                className="w-full border rounded p-3 font-mono text-xs"
                rows={24}
                readOnly
                value={clientCmd}
              />
              <p className="text-xs text-gray-600 mt-2">
                Requires Akash CLI and <code>jq</code> installed on the client system.
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
