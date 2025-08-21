// pages/_app.js
import "@/styles/globals.css";
import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect } from "react";

// Falls back to your real ID so first deploy is guaranteed to work.
// Later you can keep only the env var if you prefer.
const GA_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-YQFT6PHP65";

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url) => {
      if (typeof window !== "undefined" && window.gtag && GA_ID) {
        window.gtag("config", GA_ID, { page_path: url });
      }
    };

    // fire once on initial load
    handleRouteChange(window.location.pathname + window.location.search);

    // then on client-side route changes
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events]);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        // We'll send page_view manually (above) to avoid duplicates
        gtag('config', '${GA_ID}', { send_page_view: false });
      `}</Script>

      <Component {...pageProps} />
    </>
  );
}
