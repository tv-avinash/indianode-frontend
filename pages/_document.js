// pages/_document.js
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  const SITE_URL = "https://www.indianode.com";

  // Site-wide schema (helps "About this result" panels & brand understanding)
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "name": "Indianode",
        "url": SITE_URL,
        "logo": `${SITE_URL}/icon-512.png`,
        "sameAs": [
          "https://github.com/tv-avinash"
          // add more if you have them:
          // "https://x.com/<handle>",
          // "https://www.linkedin.com/company/<company>"
        ]
      },
      {
        "@type": "WebSite",
        "name": "Indianode",
        "url": SITE_URL,
        "potentialAction": {
          "@type": "SearchAction",
          // fallback to Google site search (no on-site search yet)
          "target": "https://www.google.com/search?q=site:indianode.com+{search_term_string}",
          "query-input": "required name=search_term_string"
        }
      }
    ]
  };

  return (
    <Html lang="en">
      <Head>
        {/* Performance hints */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://checkout.razorpay.com" />
        <link rel="dns-prefetch" href="https://checkout.razorpay.com" />

        {/* Favicons / theme */}
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#0ea5e9" />
        <meta name="robots" content="index,follow" />
        {/* Let crawlers discover your sitemap quickly */}
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />

        {/* Organization + WebSite JSON-LD */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

