// pages/whisper-gpu.js
import Head from "next/head";
import Link from "next/link";

export default function WhisperGPU() {
  const title = "Whisper on GPU (RTX 3090, 24GB) — Whisper Large v3 | Pay per minute | Indianode";
  const description =
    "GPU-accelerated Whisper speech-to-text on NVIDIA RTX 3090 (24GB). Supports Whisper Large v3. India & international payments. Deploy in minutes, pay per minute.";
  const url = "https://www.indianode.com/whisper-gpu";
  const image = "https://www.indianode.com/og/whisper-gpu.png"; // ensure this file exists

  // --- Structured Data (rich results) ---
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Can I run Whisper Large v3 on a 3090?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Our 24GB RTX 3090 runs Whisper Large v3. You pay per minute and receive the endpoint URL by email once live."
        }
      },
      {
        "@type": "Question",
        "name": "How do I pay and get the live URL?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Pay via Razorpay (INR cards/UPI) or PayPal/international cards (USD). If the GPU is busy, your job is queued and we email you when it goes live."
        }
      },
      {
        "@type": "Question",
        "name": "Do you support UAE & US buyers?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. We support INR and USD. Prices are shown in INR with an approximate USD equivalent."
        }
      }
    ]
  };

  // Enriched Product JSON-LD for better eligibility
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Whisper on NVIDIA RTX 3090 (24GB)",
    brand: { "@type": "Brand", name: "Indianode" },
    description:
      "Run OpenAI Whisper (including Large v3) on a dedicated RTX 3090. Minute-based pricing with INR and USD display. Endpoint URL emailed on deploy.",
    url,
    image: [image],                     // added
    sku: "whisper-3090-24gb",          // added (arbitrary stable id)
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: "100",                     // reference price for 60 min (adjust if needed)
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",  // added
      url,
      priceValidUntil: "2026-12-31"     // added (future date is fine)
    }
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.indianode.com/" },
      { "@type": "ListItem", position: 2, name: "Whisper on GPU", item: url }
    ]
  };

  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to deploy Whisper on RTX 3090 with Indianode",
    totalTime: "PT5M",
    step: [
      { "@type": "HowToStep", name: "Choose minutes", text: "Pick the number of minutes you want on the homepage." },
      { "@type": "HowToStep", name: "Pay", text: "Pay with INR (Razorpay) or USD (PayPal/card)." },
      { "@type": "HowToStep", name: "Get live URL", text: "If the GPU is free, we deploy immediately. Otherwise, we queue and email you the endpoint when live." }
    ]
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      </Head>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-6">
          <p className="text-sm text-gray-500">
            <Link href="/" className="underline">Home</Link> / Whisper on GPU
          </p>
          <h1 className="text-3xl font-extrabold mt-2">
            Whisper on GPU — NVIDIA RTX 3090 (24GB), supports Whisper Large v3
          </h1>
          <p className="text-gray-700 mt-2">
            GPU-accelerated speech-to-text with OpenAI Whisper. Deploy in minutes, pay per minute, endpoint URL emailed when live.
          </p>
        </header>

        {/* Feature grid */}
        <ul className="grid sm:grid-cols-2 gap-4 mb-8">
          <li className="bg-white rounded-xl p-4 shadow">
            <b>Fast start:</b> live endpoint URL emailed after deploy
          </li>
          <li className="bg-white rounded-xl p-4 shadow">
            <b>Minute pricing:</b> INR base with USD approximation
          </li>
          <li className="bg-white rounded-xl p-4 shadow">
            <b>UAE & US ready:</b> international cards / PayPal (USD)
          </li>
          <li className="bg-white rounded-xl p-4 shadow">
            <b>Queue + notify:</b> automatic email when GPU frees up
          </li>
        </ul>

        {/* Simple How-to section (mirrors HowTo JSON-LD) */}
        <section className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-8">
          <h2 className="text-2xl font-bold mb-2">How deployment works</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>Choose your minutes on the homepage.</li>
            <li>Pay in INR (Razorpay/UPI/cards) or USD (PayPal/cards).</li>
            <li>We deploy and email your live endpoint URL. If busy, you’re queued automatically.</li>
          </ol>
          <div className="mt-4">
            <Link href="/" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl">
              Start now
            </Link>
          </div>
        </section>

        {/* Example API usage (keyword boost: whisper api, transcription endpoint) */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">Example: call the transcription API</h2>
          <pre className="bg-black text-white text-sm p-4 rounded-xl overflow-x-auto">
{`POST https://<your-endpoint>/api/whisper/transcribe
Headers: Authorization: Bearer <token>
Body (multipart/form-data):
  - file=@audio.wav
  - model=large-v3
  - language=en`}
          </pre>
          <p className="text-gray-700 mt-2">
            We’ll share your actual endpoint and token in the deployment email.
          </p>
        </section>

        {/* Internal links help indexing & topical authority */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">Related GPU services</h2>
          <ul className="list-disc pl-6">
            <li><Link className="text-blue-600 underline" href="/sdls">SDLS Hosting on RTX 3090</Link></li>
            <li><Link className="text-blue-600 underline" href="/llm-hosting">LLM Inference Hosting</Link></li>
          </ul>
        </section>

        {/* FAQ section (mirrors FAQ JSON-LD) */}
        <section aria-labelledby="faq" className="mb-12">
          <h2 id="faq" className="text-2xl font-bold mb-3">Frequently asked questions</h2>
          <div className="space-y-3 text-gray-800">
            <div>
              <b>Which Whisper variants are supported?</b>
              <p>All popular sizes, including Large v3. The 24GB 3090 balances cost and speed.</p>
            </div>
            <div>
              <b>How do I get billed?</b>
              <p>Minute-based pricing. After payment, we deploy; if busy, we queue and notify you when live.</p>
            </div>
            <div>
              <b>Enterprise invoices / custom SLAs?</b>
              <p>
                Yes — email{" "}
                <a className="text-blue-600 underline" href="mailto:tvavinash@gmail.com">
                  tvavinash@gmail.com
                </a>.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
