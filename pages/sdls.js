// pages/sdls.js
import Head from "next/head";

export default function SDLSPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "SDLS Hosting",
    provider: { "@type": "Organization", name: "Indianode", url: "https://www.indianode.com" },
    areaServed: "Worldwide",
    description: "Run Standard Development Lease Scripts (SDLS) on dedicated RTX 3090 GPUs.",
    offers: { "@type": "Offer", priceCurrency: "USD", price: "Contact" }
  };

  return (
    <>
      <Head>
        <title>SDLS Hosting on RTX 3090 | Indianode</title>
        <meta
          name="description"
          content="Run Standard Development Lease Scripts (SDLS) on Indianode’s NVIDIA RTX 3090. Fast, reliable GPU hosting."
        />
        <link rel="canonical" href="https://www.indianode.com/sdls" />
        <meta property="og:title" content="SDLS Hosting on RTX 3090" />
        <meta property="og:description" content="Fast, reliable SDLS hosting on NVIDIA RTX 3090 GPUs." />
        <meta property="og:url" content="https://www.indianode.com/sdls" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <main style={{maxWidth: 880, margin: "0 auto", padding: "2rem 1rem"}}>
        <h1>SDLS Hosting on RTX 3090</h1>
        <p>
          Deploy and run <strong>Standard Development Lease Scripts (SDLS)</strong> on high-performance NVIDIA RTX 3090 GPUs.
          Ideal for AI inference, batch jobs, and microservices needing predictable GPU throughput.
        </p>

        <h2>Why Indianode</h2>
        <ul>
          <li>Dedicated RTX 3090 (24 GB VRAM)</li>
          <li>Fast spin-up via Akash provider</li>
          <li>HTTPS endpoints, monitoring, and logs</li>
          <li>Transparent, usage-based pricing</li>
        </ul>

        <h2>How it works</h2>
        <ol>
          <li>Share your SDLS repo or container image.</li>
          <li>We provision on our 3090 node and return a public endpoint.</li>
          <li>Monitor usage and scale up/down as needed.</li>
        </ol>

        <p>
          Related: <a href="/whisper-gpu">Whisper on GPU</a> • <a href="/llm-hosting">LLM hosting</a>
        </p>
      </main>
    </>
  );
}
