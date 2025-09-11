// pages/llm-hosting.js
import Link from "next/link";
import SEO from "@/components/SEO";

export default function LlmHosting() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "LLM Hosting on GPU",
    serviceType: "Model serving / inference",
    provider: { "@type": "Organization", name: "Indianode", url: "https://www.indianode.com" },
    areaServed: "India",
    offers: { "@type": "Offer", priceCurrency: "INR", price: "Contact" },
  };

  return (
    <>
      <SEO
        title="LLM Hosting on GPUs in India – Serve GPT-style Models | Indianode"
        description="Host, fine-tune, and serve LLMs on dedicated RTX GPUs in India. Low latency endpoints for inference and experimentation."
        canonical="https://www.indianode.com/llm-hosting"
        keywords="llm hosting india, serve llm gpu, inference endpoint india"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "LLM hosting", url: "/llm-hosting" },
        ]}
        schema={schema}
      />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1>LLM Hosting on GPUs</h1>
        <p>
          Serve GPT-style models with low latency on <strong>dedicated RTX 3090/4090</strong> instances. Bring your own
          weights or select from curated open-source models. For longer experiments or fine-tunes, consider our{" "}
          <Link href="/gpu-rental-india" className="text-blue-600 underline">
            GPU rental in India
          </Link>{" "}
          plans, and use{" "}
          <Link href="/compute-sdl" className="text-blue-600 underline">
            SDL deployment
          </Link>{" "}
          to automate pipelines.
        </p>

        <h2>Features</h2>
        <ul>
          <li>HTTPS inference endpoints, token auth, request logging</li>
          <li>Autoscale presets; upgrade/downgrade GPU model</li>
          <li>Optional vector DB & caching layers</li>
        </ul>

        <h2>Use cases</h2>
        <ul>
          <li>Chat assistants, RAG pipelines, structured extraction</li>
          <li>Batch inference jobs and A/B testing</li>
          <li>Prototype → production migration on the same stack</li>
        </ul>

        <p>
          Related:&nbsp;
          <Link href="/whisper-gpu" className="text-blue-600 underline">
            Whisper on GPU
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
