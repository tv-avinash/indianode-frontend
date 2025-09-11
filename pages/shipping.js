// pages/shipping.js
import Link from "next/link";
import SEO from "@/components/SEO";

export default function Shipping() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Shipping & Fulfillment",
    url: "https://www.indianode.com/shipping",
  };

  return (
    <>
      <SEO
        title="Shipping & Fulfillment | Indianode"
        description="Digital services fulfillment details for Indianode."
        canonical="https://www.indianode.com/shipping"
        keywords="shipping fulfillment indianode"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Shipping", url: "/shipping" },
        ]}
        schema={schema}
      />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1>Shipping &amp; Fulfillment</h1>
        <p>
          Indianode provides <strong>digital services</strong>. After payment, your deployment or minutes are provisioned
          automatically and visible in your dashboard or via email/token. For self-serve{" "}
          <Link href="/compute-sdl" className="text-blue-600 underline">SDL deployment</Link> purchases, you’ll receive
          a one-time ORDER_TOKEN to run commands immediately.
        </p>
      </main>
    </>
  );
}
