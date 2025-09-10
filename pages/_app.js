// pages/_app.js
import "@/styles/globals.css";
import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Footer from "@/components/Footer"; // ⬅️ added

// keep your env var; fallback to your real ID so it always works
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-YQFT6PHP65";

function sendPageview(path) {
  if (typeof window !== "undefined" && window.gtag && GA_ID) {
    window.gtag("event", "page_view", {
      page_location: window.location.origin + path,
      page_path: path,
      page_title: document.title,
    });
  }
}

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    // Fire ONE page_view when gtag finishes loading
    let tries = 0;
    const timer = setInterval(() => {
      if (typeof window !== "undefined" && window.gtag) {
        sendPageview(window.location.pathname + window.location.search);
        clearInterval(timer);
      } else if (++tries > 40) {
        clearInterval(timer); // give up after ~4s
      }
    }, 100);

    // Fire on SPA route changes
    const handleRouteChange = (url) => sendPageview(url);
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
      clearInterval(timer);
    };
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
        // we'll send page_view manually (above)
        gtag('config', '${GA_ID}', { send_page_view: false });
      `}</Script>

      <Component {...pageProps} />
      <Footer /> {/* ⬅️ added; renders on every page without touching GA4 */}
    </>
  );
}
