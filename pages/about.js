// pages/about.js
import Link from "next/link";
import SEO from "@/components/SEO";

export default function About() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Indianode",
    url: "https://www.indianode.com",
    sameAs: [],
  };

  return (
    <>
      <SEO
        title="About Indianode – GPU Cloud in India"
        description="Indianode provides affordable GPU compute for AI/ML, rendering, and SDL deployments in India."
        canonical="https://www.indianode.com/about"
        keywords="about indianode, gpu cloud india"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
        ]}
        schema={schema}
      />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1>About Indianode</h1>
        <p>
          We’re building a developer-friendly platform for AI/ML, rendering, and compute workloads on{" "}
          <strong>high-performance RTX GPUs</strong>. Many users start with{" "}
          <Link href="/gpu-rental-india" className="text-blue-600 underline">
            GPU rental in India
          </Link>{" "}
          and automate pipelines through{" "}
          <Link href="/compute-sdl" className="text-blue-600 underline">
            SDL deployment
          </Link>
          .
        </p>

        <p>
          Whether you’re prototyping a new LLM, transcribing media with{" "}
          <Link href="/whisper-gpu" className="text-blue-600 underline">
            Whisper on GPU
          </Link>
          , or doing batch renders with{" "}
          <Link href="/gpu-render-service" className="text-blue-600 underline">
            GPU for rendering
          </Link>
          , Indianode aims to remove friction so you can ship faster.
        </p>
      </main>
    </>
  );
}
