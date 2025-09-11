// components/SEO.js
import Head from "next/head";

export default function SEO({
  title = "GPU Rental in India – AI/ML, Rendering, SDL Deploy | Indianode",
  description = "Rent powerful GPUs (RTX 3090/4090) for AI/ML training, inference, and rendering. Pay per minute with Razorpay. SDL deployments and non-GPU compute included.",
  canonical = "https://www.indianode.com/",
  keywords = [
    "gpu rental india",
    "ai ml gpu compute",
    "rendering gpu",
    "cloud gpu rtx 3090 4090",
    "akash sdl deployment",
    "gpu server on demand",
  ].join(", "),
  ogImage = "https://www.indianode.com/og-cover.png", // keep or replace
  breadcrumbs = [], // [{name:'Home', url:'/'}, ...]
  schema = {}, // extra JSON-LD
}) {
  const siteName = "Indianode";
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: "https://www.indianode.com/",
    logo: "https://www.indianode.com/logo512.png",
  };

  const webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: "https://www.indianode.com/",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://www.indianode.com/search?q={query}",
      "query-input": "required name=query",
    },
  };

  const breadcrumbSchema =
    breadcrumbs?.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbs.map((b, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: b.name,
            item: `https://www.indianode.com${b.url}`,
          })),
        }
      : null;

  const schemas = [orgSchema, webSiteSchema, breadcrumbSchema, schema]
    .filter(Boolean);

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonical} />

      {/* Open Graph / Twitter */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:card" content="summary_large_image" />

      {/* JSON-LD */}
      {schemas.map((obj, idx) => (
        <script
          key={idx}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}
        />
      ))}
    </Head>
  );
}
