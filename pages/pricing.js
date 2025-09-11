// pages/pricing.js
import Link from "next/link";
import SEO from "@/components/SEO";

export default function Pricing() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Indianode Pricing",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: "GPU Rental (RTX 3090/4090)" },
        priceCurrency: "INR",
        price: "Varies",
      },
      {
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: "Non-GPU Compute (CPU/RAM)" },
        priceCurrency: "INR",
        price: "Varies",
      },
    ],
    url: "https://www.indianode.com/pricing",
  };

  return (
    <>
      <SEO
        title="GPU Pricing – RTX 3090/4090 & Compute Rates | Indianode"
        description="Transparent pricing for GPU and non-GPU compute. Pay per minute. Simple tokens, Razorpay support, no wallet needed for basic flows."
        canonical="https://www.indianode.com/pricing"
        keywords="gpu pricing india, rtx 3090 price per minute, render gpu cost, ai gpu rates"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Pricing", url: "/pricing" },
        ]}
        schema={schema}
      />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1>Pricing</h1>
        <p>
          Choose what you need and pay by the minute. For long-running jobs, our{" "}
          <Link href="/gpu-rental-india" className="text-blue-600 underline">
            GPU rental in India
          </Link>{" "}
          saves time and money. For quick jobs or one-offs, use{" "}
          <Link href="/compute-sdl" className="text-blue-600 underline">
            SDL deployment
          </Link>
          . Rendering users can explore{" "}
          <Link href="/gpu-render-service" className="text-blue-600 underline">
            GPU for rendering
          </Link>
          .
        </p>

        <h2>Typical rates</h2>
        <ul>
          <li>RTX 3090 (24GB): pay-per-minute, volume discounts available</li>
          <li>RTX 4090 (24GB): higher throughput for training/inference</li>
          <li>CPU/RAM compute: short-lived tasks and microservices</li>
        </ul>

        <p>
          Need a custom plan or reserved capacity?{" "}
          <Link href="/contact" className="text-blue-600 underline">
            Contact us
          </Link>
          .
        </p>
      </main>
    </>
  );
}
