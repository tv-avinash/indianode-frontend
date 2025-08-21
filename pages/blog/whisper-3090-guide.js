import Head from "next/head";
import Link from "next/link";

export default function Whisper3090Guide() {
  return (
    <>
      <Head>
        <title>Run Whisper on RTX 3090 — Quick Start | Indianode</title>
        <meta name="description" content="Step-by-step: deploy Whisper (Large v3) on NVIDIA RTX 3090 with Indianode. Example API call and tips." />
        <link rel="canonical" href="https://www.indianode.com/blog/whisper-3090-guide" />
      </Head>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-4">Run Whisper on RTX 3090 — Quick Start</h1>
        <p className="mb-4">
          Deploy OpenAI Whisper (including Large v3) on a dedicated NVIDIA RTX 3090 (24GB) and call the transcription API.
        </p>
        <h2 className="text-xl font-semibold mt-6 mb-2">1) Choose minutes & pay</h2>
        <p className="mb-3">
          Go to <Link className="text-blue-600 underline" href="/whisper-gpu">Whisper on GPU</Link>, choose minutes, and pay in INR (Razorpay) or USD (PayPal/cards).
        </p>
        <h2 className="text-xl font-semibold mt-6 mb-2">2) Receive your endpoint</h2>
        <p className="mb-3">
          If the GPU is free we deploy immediately; otherwise we queue and email you the live URL + token.
        </p>
        <h2 className="text-xl font-semibold mt-6 mb-2">3) Example request</h2>
        <pre className="bg-black text-white text-sm p-4 rounded-xl overflow-x-auto">
{`POST https://<your-endpoint>/api/whisper/transcribe
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=@audio.wav
model=large-v3
language=en`}
        </pre>
        <p className="mt-3">Tip: Use 16 kHz mono WAV for speed and accuracy.</p>
        <hr className="my-8" />
        <p>
          Also see: <Link className="text-blue-600 underline" href="/sdls">SDLS hosting</Link> ·{" "}
          <Link className="text-blue-600 underline" href="/llm-hosting">LLM hosting</Link>.
        </p>
      </main>
    </>
  );
}
