// pages/sdls.js
import Link from "next/link";
import SEO from "@/components/SEO";

export default function SDLSPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "SDLS Hosting",
    provider: {
      "@type": "Organization",
      name: "Indianode",
      url: "https://www.indianode.com"
    },
    areaServed: "Worldwide",
    description:
      "Run Standard Development Lease Scripts (SDLS) on dedicated RTX 3090 GPUs.",
    offers: { "@type": "Offer", priceCurrency: "USD", price: "Contact" }
  };

  return (
    <>
      {/* ✅ Use SEO component INSIDE the page, not wrapped in <Head> */}
      <SEO
        title="SDL Deployment on Akash – Ready-Made SDLS Hosting (RTX 3090) | Indianode"
        description="Deploy and run Standard Development Lease Scripts (SDLS) on high-performance NVIDIA RTX 3090 GPUs. Ideal for AI inference, batch jobs, and microservices."
        canonical="https://www.indianode.com/sdls"
        keywords="sdl deployment, akash sdl hosting, gpu sdl, deploy sdl india"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "SDLs", url: "/sdls" }
        ]}
        schema={jsonLd} // ⬅️ JSON-LD injected via SEO
      />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1>SDLS Hosting on RTX 3090</h1>
        <p>
          Deploy and run <strong>Standard Development Lease Scripts (SDLS)</strong> on
          high-performance NVIDIA RTX 3090 GPUs. Ideal for AI inference, batch jobs, and
          microservices needing predictable GPU throughput.
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
          Related:&nbsp;
          <Link href="/whisper-gpu" className="text-blue-600 underline">
            Whisper on GPU
          </Link>
          &nbsp;•&nbsp;
          <Link href="/llm-hosting" className="text-blue-600 underline">
            LLM hosting
          </Link>
        </p>
      </main>
    </>
  );
}
