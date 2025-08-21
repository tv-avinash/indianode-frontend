// pages/_app.js
import "@/styles/globals.css";
import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-XXXXXXX";

export default function App({ Component, pageProps }) {
  const router = useRouter();

  // Send a page_view on route changes (SPA behavior)
  useEffect(() => {
    const handleRouteChange = (url) => {
      if (window.gtag && GA_ID && GA_ID !== "G-XXXXXXX") {
        window.gtag("config", GA_ID, { page_path: url });
      }
    };
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events]);

  return (
    <>
      {/* GA4 base snippet */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        // Disable auto page_view; we'll send on route changes
        gtag('config', '${GA_ID}', { send_page_view: false });
      `}</Script>

      <Component {...pageProps} />
    </>
  );
}

