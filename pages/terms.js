// pages/terms.js
import Link from "next/link";
import SEO from "@/components/SEO";

export default function Terms() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Terms of Service",
    url: "https://www.indianode.com/terms",
  };

  return (
    <>
      <SEO
        title="Terms of Service | Indianode"
        description="The rules that govern your use of Indianode services."
        canonical="https://www.indianode.com/terms"
        keywords="terms of service indianode"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Terms", url: "/terms" },
        ]}
        schema={schema}
      />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1>Terms of Service</h1>
        <p>By using Indianode, you agree to the following terms.</p>

        <h2>Acceptable use</h2>
        <p>
          You’re responsible for your jobs and data. Avoid prohibited content and ensure compliance
          with applicable laws. For specialized workloads (e.g.,{" "}
          <Link href="/compute-sdl" className="text-blue-600 underline">SDL deployment</Link> or{" "}
          <Link href="/gpu-render-service" className="text-blue-600 underline">GPU for rendering</Link>), confirm you
          have appropriate rights for datasets and media.
        </p>

        <h2>Billing</h2>
        <p>Pay-per-minute billing applies unless otherwise agreed. See our <Link href="/pricing" className="text-blue-600 underline">Pricing</Link>.</p>
      </main>
    </>
  );
}
