// pages/_app.js
import "@/styles/globals.css";
import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Footer from "@/components/Footer";

// GA4 (existing) + Google Ads (new)
const GA_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-YQFT6PHP65"; // GA4
const ADS_ID =
  process.env.NEXT_PUBLIC_GTAG_ADS_ID || "AW-17546581584";      // Google Ads

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
    let tries = 0;
    const timer = setInterval(() => {
      if (typeof window !== "undefined" && window.gtag) {
        sendPageview(window.location.pathname + window.location.search);
        clearInterval(timer);
      } else if (++tries > 40) {
        clearInterval(timer);
      }
    }, 100);

    const handleRouteChange = (url) => sendPageview(url);
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
      clearInterval(timer);
    };
  }, [router.events]);

  return (
    <>
      {/* Load gtag once */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID || ADS_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        // Configure GA4 (no auto page_view; we send it manually)
        ${GA_ID ? `gtag('config', '${GA_ID}', { send_page_view: false });` : ""}

        // Configure Google Ads (for account verification & conversions)
        ${ADS_ID ? `gtag('config', '${ADS_ID}');` : ""}
      `}</Script>

      <Component {...pageProps} />
      <Footer />
    </>
  );
}
