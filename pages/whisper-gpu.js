import Head from "next/head";
import Link from "next/link";

export default function WhisperGPU() {
  const title = "Whisper GPU (NVIDIA 3090) – Pay per minute | Indianode";
  const description =
    "Run OpenAI Whisper on a 24GB NVIDIA 3090. India & international payments. Deploy in minutes, pay per minute, get the live URL by email.";
  const url = "https://www.indianode.com/whisper-gpu";
  const image = "https://www.indianode.com/og/whisper-gpu.png"; // optional OG image if you have one

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Can I run Whisper Large v3 on a 3090?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Our 24GB 3090 runs Whisper Large v3. Pay per minute; once live, you receive the endpoint URL by email."
        }
      },
      {
        "@type": "Question",
        "name": "How do I pay and get the live URL?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Pay via Razorpay (INR cards/UPI) or PayPal/International cards (USD). If the GPU is busy, your job is queued and we email you when it goes live."
        }
      },
      {
        "@type": "Question",
        "name": "Do you support UAE & US buyers?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. We support INR and USD. You’ll see prices in INR and an approximate USD equivalent on our site."
        }
      }
    ]
  };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Whisper on NVIDIA 3090 (24GB)",
    "brand": "Indianode",
    "description": "Run OpenAI Whisper (including Large v3) on a dedicated 24GB 3090. Minute-based pricing with INR and USD display.",
    "url": url,
    "offers": {
      "@type": "Offer",
      "priceCurrency": "INR",
      "price": "100",          // your 60-min reference price
      "availability": "https://schema.org/InStock",
      "url": url
    }
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />

        {/* Canonical + OG/Twitter */}
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        {image ? <meta property="og:image" content={image} /> : null}
        <meta name="twitter:card" content="summary_large_image" />

        {/* Structured data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      </Head>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-extrabold mb-3">
          Run OpenAI Whisper on NVIDIA 3090 (24GB) – Pay per minute
        </h1>
        <p className="text-gray-700 mb-6">
          Transcribe audio with Whisper (including Large v3) on a dedicated 24GB 3090. India & international
          payments supported. If the GPU is busy, we queue your job and email you the live URL.
        </p>

        <ul className="grid sm:grid-cols-2 gap-4 mb-8">
          <li className="bg-white rounded-xl p-4 shadow">
            <b>Fast start:</b> live URL emailed to you on deploy
          </li>
          <li className="bg-white rounded-xl p-4 shadow">
            <b>Minute pricing:</b> INR base with USD approximation
          </li>
          <li className="bg-white rounded-xl p-4 shadow">
            <b>UAE & US ready:</b> international cards/PayPal supported (USD)
          </li>
          <li className="bg-white rounded-xl p-4 shadow">
            <b>Queue + notify:</b> automatic email when the GPU frees up
          </li>
        </ul>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-8">
          <p className="mb-3">
            Ready to deploy Whisper now? Use the product card on the homepage and select your minutes. You’ll see
            INR and an approximate USD price, and receive the deployment URL by email.
          </p>
          <Link href="/" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl">
            Start now
          </Link>
        </div>

        <h2 className="text-2xl font-bold mb-3">Frequently asked questions</h2>
        <div className="space-y-3 text-gray-800">
          <div>
            <b>Which Whisper variants are supported?</b>
            <p>All popular sizes, including Large v3. The 24GB 3090 is a good balance of cost and speed.</p>
          </div>
          <div>
            <b>How do I get billed?</b>
            <p>Minute-based pricing. After payment, we deploy. If busy, your job is queued and we notify when live.</p>
          </div>
          <div>
            <b>Do you support enterprise invoices or custom SLAs?</b>
            <p>Yes—email <a className="text-blue-600 underline" href="mailto:tvavinash@gmail.com">tvavinash@gmail.com</a>.</p>
          </div>
        </div>
      </main>
    </>
  );
}
