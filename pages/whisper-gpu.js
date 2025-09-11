// pages/whisper-gpu.js
import Link from "next/link";
import SEO from "@/components/SEO";

export default function WhisperGPU() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Whisper on GPU (RTX 3090)",
    applicationCategory: "SpeechToText",
    operatingSystem: "Linux",
    offers: { "@type": "Offer", priceCurrency: "INR", price: "Contact" },
    provider: {
      "@type": "Organization",
      name: "Indianode",
      url: "https://www.indianode.com",
    },
  };

  return (
    <>
      <SEO
        title="Whisper on GPU (RTX 3090, 24GB) – Fast Speech-to-Text | Indianode"
        description="GPU-accelerated OpenAI Whisper on RTX 3090. Deploy in minutes, pay per minute, get a live HTTPS endpoint. Great for transcription workflows."
        canonical="https://www.indianode.com/whisper-gpu"
        keywords="whisper gpu, whisper large v3, speech to text gpu, asr gpu rental"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Whisper GPU", url: "/whisper-gpu" },
        ]}
        schema={schema}
      />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1>Whisper on GPU (RTX 3090)</h1>
        <p>
          Deploy OpenAI Whisper on our dedicated <strong>RTX 3090 (24GB)</strong> nodes and get a public HTTPS endpoint
          within minutes. Ideal for transcription, subtitles, and audio batch jobs. Many users pair this with{" "}
          <Link href="/gpu-rental-india" className="text-blue-600 underline">
            GPU rental in India
          </Link>{" "}
          for sustained workloads, or quick{" "}
          <Link href="/compute-sdl" className="text-blue-600 underline">
            SDL deployment
          </Link>{" "}
          to run one-off tasks.
        </p>

        <h2>Highlights</h2>
        <ul>
          <li>Whisper Large-V3 and Medium variants available</li>
          <li>HTTPS endpoint with logs & simple auth</li>
          <li>Usage-based billing; pause/resume easily</li>
        </ul>

        <h2>Typical workflow</h2>
        <ol>
          <li>Select desired Whisper model and spin up a service.</li>
          <li>Send audio via REST/gRPC; receive text transcripts.</li>
          <li>Scale up/down or switch model size as needed.</li>
        </ol>

        <p>
          Related:&nbsp;
          <Link href="/llm-hosting" className="text-blue-600 underline">
            LLM hosting
          </Link>
          &nbsp;•&nbsp;
          <Link href="/gpu-render-service" className="text-blue-600 underline">
            GPU for rendering
          </Link>
          &nbsp;•&nbsp;
          <Link href="/pricing" className="text-blue-600 underline">
            Pricing
          </Link>
        </p>
      </main>
    </>
  );
}
