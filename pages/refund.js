// pages/refund.js
import Link from "next/link";
import SEO from "@/components/SEO";

export default function Refund() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Refund Policy",
    url: "https://www.indianode.com/refund",
  };

  return (
    <>
      <SEO
        title="Refund Policy | Indianode"
        description="Our refunds and cancellations policy."
        canonical="https://www.indianode.com/refund"
        keywords="refund policy indianode"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Refund", url: "/refund" },
        ]}
        schema={schema}
      />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1>Refund Policy</h1>
        <p>
          For prepaid minutes, unused balances may be refundable per local laws and our discretion. If a service incident
          impacts your jobs, contact{" "}
          <a className="text-blue-600 underline" href="mailto:support@indianode.com">support@indianode.com</a>.
        </p>
        <p>
          For one-off <Link href="/compute-sdl" className="text-blue-600 underline">SDL deployment</Link> purchases, we
          may issue partial credits when failures are caused by platform issues.
        </p>
      </main>
    </>
  );
}
