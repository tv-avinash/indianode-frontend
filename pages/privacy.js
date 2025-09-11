// pages/privacy.js
import Link from "next/link";
import SEO from "@/components/SEO";

export default function Privacy() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Privacy Policy",
    url: "https://www.indianode.com/privacy",
  };

  return (
    <>
      <SEO
        title="Privacy Policy | Indianode"
        description="How Indianode collects, uses, and protects your data."
        canonical="https://www.indianode.com/privacy"
        keywords="privacy policy indianode"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Privacy", url: "/privacy" },
        ]}
        schema={schema}
      />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1>Privacy Policy</h1>
        <p>We value your privacy. This policy explains what data we collect, how we use it, and your choices.</p>

        <h2>Information we collect</h2>
        <ul>
          <li>Account and billing details (when provided)</li>
          <li>Usage metrics for debugging and reliability</li>
          <li>Payment confirmations via our provider</li>
        </ul>

        <h2>How we use information</h2>
        <ul>
          <li>To provide and improve services like{" "}
            <Link href="/gpu-rental-india" className="text-blue-600 underline">GPU rental in India</Link>
            ,{" "}
            <Link href="/compute-sdl" className="text-blue-600 underline">SDL deployment</Link>
            , and{" "}
            <Link href="/gpu-render-service" className="text-blue-600 underline">GPU for rendering</Link>.
          </li>
          <li>To communicate service incidents and updates</li>
          <li>To comply with legal and accounting obligations</li>
        </ul>
      </main>
    </>
  );
}
