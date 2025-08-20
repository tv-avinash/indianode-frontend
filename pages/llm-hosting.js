// pages/llm-hosting.js
import Head from "next/head";

export default function LLMHostingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "LLM Inference Hosting",
    provider: { "@type": "Organization", name: "Indianode" },
    description: "Serve popular LLMs on RTX 3090 with optimized inference pipelines.",
    areaServed: "Worldwide"
  };

  return (
    <>
      <Head>
        <title>LLM Inference on 3090 — Affordable GPU Hosting | Indianode</title>
        <meta
          name="description"
          content="Serve LLMs on RTX 3090 with vLLM/TGI, quantization options, and basic monitoring. Great for chatbots and RAG."
        />
        <link rel="canonical" href="https://www.indianode.com/llm-hosting" />
        <meta property="og:title" content="LLM Inference on RTX 3090 — Indianode" />
        <meta property="og:description" content="Deploy and serve LLMs on RTX 3090 with sensible defaults." />
        <meta property="og:url" content="https://www.indianode.com/llm-hosting" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <main style={{maxWidth: 880, margin: "0 auto", padding: "2rem 1rem"}}>
        <h1>LLM Inference on RTX 3090</h1>
        <p>
          Deploy quantized or full-precision <strong>LLMs</strong> with throughput-focused settings.
          Perfect for prototypes, internal tools, and small-to-mid scale apps.
        </p>

        <h2>Supported setups</h2>
        <ul>
          <li>vLLM / Text-Generation-Inference</li>
          <li>Quantization: AWQ, GGUF, GPTQ (model-dependent)</li>
          <li>Observability: logs + basic metrics</li>
        </ul>

        <h2>Process</h2>
        <ol>
          <li>Share model + container (or choose a template).</li>
          <li>We deploy on our Akash-backed 3090 node.</li>
          <li>You get the public endpoint and usage guidance.</li>
        </ol>

        <p>
          Related: <a href="/whisper-gpu">Whisper on GPU</a> • <a href="/sdls">SDLS hosting</a>
        </p>
      </main>
    </>
  );
}
