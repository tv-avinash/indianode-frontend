// pages/gpu-rental-india.js
import Link from "next/link";
import SEO from "@/components/SEO";

export default function GpuRentalIndia() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "GPU Rental in India",
    provider: { "@type": "Organization", name: "Indianode", url: "https://www.indianode.com" },
    areaServed: "IN",
    serviceType: "On-demand GPU compute (RTX 3090/4090)",
    offers: { "@type": "Offer", priceCurrency: "INR", price: "Varies" },
    url: "https://www.indianode.com/gpu-rental-india"
  };

  return (
    <>
      <SEO
        title="GPU Rental in India – RTX 3090/4090 for AI/ML & Rendering | Indianode"
        description="Rent powerful GPUs in India for AI/ML, LLMs, and rendering. Start quickly with on-demand RTX 3090/4090, pay-by-the-minute billing, and optional SDL deployment."
        canonical="https://www.indianode.com/gpu-rental-india"
        keywords="gpu rental india, rent rtx 3090, rent rtx 4090, ai ml gpu compute, cloud gpu india"
        breadcrumbs={[{ name: "Home", url: "/" }, { name: "GPU Rental India", url: "/gpu-rental-india" }]}
        schema={schema}
      />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1>GPU Rental in India (RTX 3090/4090)</h1>
        <p>
          Spin up <strong>dedicated RTX 3090/4090</strong> capacity in India for training, fine-tuning, inference, and
          rendering. Indianode offers <em>pay-per-minute</em> billing, simple tokens, and quick boot times. For short
          tasks or automation, try our{" "}
          <Link href="/compute-sdl" className="text-blue-600 underline">SDL deployment</Link>; for media workloads, see{" "}
          <Link href="/gpu-render-service" className="text-blue-600 underline">GPU for rendering</Link>.
        </p>

        <h2>Who is this for?</h2>
        <ul>
          <li>AI/ML teams running fine-tunes, embeddings, or batch inference</li>
          <li>Researchers and students experimenting with open models</li>
          <li>Studios & creators needing accelerated video/image rendering</li>
          <li>Engineers building services that require a dedicated GPU</li>
        </ul>

        <h2>Hardware</h2>
        <ul>
          <li>RTX 3090 (24 GB VRAM) — reliable, affordable training/inference</li>
          <li>RTX 4090 (24 GB VRAM) — higher throughput for larger models</li>
          <li>Fast local NVMe + high-speed CPU/RAM for preprocessing</li>
        </ul>

        <h2>Why Indianode</h2>
        <ul>
          <li>On-demand capacity with <strong>pay-as-you-go</strong> billing</li>
          <li>Low latency for India-based users and data residency friendly</li>
          <li>Optional managed endpoints (see{" "}
            <Link href="/llm-hosting" className="text-blue-600 underline">LLM hosting</Link> and{" "}
            <Link href="/whisper-gpu" className="text-blue-600 underline">Whisper on GPU</Link>
            )</li>
          <li>CLI/terminal-first workflows via{" "}
            <Link href="/compute-sdl" className="text-blue-600 underline">SDL deployment</Link>
          </li>
        </ul>

        <h2>How billing works</h2>
        <p>
          You purchase minutes and redeem them with a one-time token. See{" "}
          <Link href="/pricing" className="text-blue-600 underline">Pricing</Link> for typical rates. Minutes can be used
          for <Link href="/gpu-rental-india" className="text-blue-600 underline">GPU rental in India</Link>,{" "}
          <Link href="/compute-sdl" className="text-blue-600 underline">SDL deployment</Link>, or managed services like{" "}
          <Link href="/llm-hosting" className="text-blue-600 underline">LLM hosting</Link>.
        </p>

        <h2>Typical setup</h2>
        <ol>
          <li>Choose a GPU (3090/4090) and expected minutes.</li>
          <li>Provision a node or use an existing template (e.g., PyTorch, TensorRT).</li>
          <li>Deploy via <Link href="/compute-sdl" className="text-blue-600 underline">SDL deployment</Link> or use SSH.</li>
          <li>Run workloads and monitor usage. Scale up or pause anytime.</li>
        </ol>

        <h2>Best practices</h2>
        <ul>
          <li>Profile your model locally; bring only necessary assets to reduce spin-up time.</li>
          <li>Use mixed precision (AMP/bfloat16) where possible.</li>
          <li>Cache datasets on NVMe; stream from object storage for large corpora.</li>
          <li>For rendering, see our{" "}
            <Link href="/gpu-render-service" className="text-blue-600 underline">GPU for rendering</Link> notes.</li>
        </ul>

        <p className="mt-4">
          Ready to start? Check{" "}
          <Link href="/pricing" className="text-blue-600 underline">Pricing</Link> or{" "}
          <Link href="/contact" className="text-blue-600 underline">Contact us</Link> for reserved capacity.
        </p>
      </main>
    </>
  );
}
