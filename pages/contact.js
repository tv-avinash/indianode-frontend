// pages/contact.js
import SEO from "@/components/SEO";

export default function Contact() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    url: "https://www.indianode.com/contact",
    breadcrumb: { "@type": "BreadcrumbList", itemListElement: [] },
  };

  return (
    <>
      <SEO
        title="Contact Indianode – Support & Sales"
        description="Get in touch with Indianode for support, billing, and sales inquiries."
        canonical="https://www.indianode.com/contact"
        keywords="contact indianode, gpu support india, sales indianode"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Contact", url: "/contact" },
        ]}
        schema={schema}
      />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1>Contact</h1>
        <p>For support or sales, email us at: <a className="text-blue-600 underline" href="mailto:support@indianode.com">support@indianode.com</a></p>
        <p>We usually respond within 1–2 business days.</p>
      </main>
    </>
  );
}
