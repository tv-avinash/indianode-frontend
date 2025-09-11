// pages/compute-sdl.jsx
import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import SEO from "@/components/SEO";

// GA helper
const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

function Modal({ open, onClose, children, title = "Next steps" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-2 rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-base">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-gray-100" aria-label="Close">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function ComputeSDL() {
  // Inputs
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [promo, setPromo] = useState("");

  // SDL text
  const [sdl, setSdl] = useState(
    `version: "2.0"

services:
  web:
    image: nginx:alpine
    expose:
      - port: 80
        as: 80
        to:
          - global: true

deployment:
  web:
    dcloud:
      profile: web
      count: 1
`.replace(/\r\n/g, "\n")
  );

  // UI state
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [mintOpen, setMintOpen] = useState(false);
  const [mintToken, setMintToken] = useState("");
  const [mintCmd, setMintCmd] = useState("");
  const [mintCmdWin, setMintCmdWin] = useState("");
  const [osTab, setOsTab] = useState("linux");

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      setOsTab(ua.includes("windows") ? "windows" : "linux");
    }
  }, []);

  // Helper to b64 the SDL textarea
  const sdlB64 = useMemo(() => {
    try {
      return btoa(unescape(encodeURIComponent(String(sdl || ""))));
    } catch {
      return btoa(String(sdl || ""));
    }
  }, [sdl]);

  function getRunUrl() {
    try {
      if (typeof window !== "undefined") {
        return `${window.location.origin}/api/compute/run-sdl.sh`;
      }
    } catch {}
    return "https://www.indianode.com/api/compute/run-sdl.sh";
  }

  function buildCommands(token) {
    const url = getRunUrl();
    const posix = `export ORDER_TOKEN='${token}'
export SDL_B64='${sdlB64}'
curl -fsSL ${url} | bash`;
    const win = `$env:ORDER_TOKEN = '${token}'
$env:SDL_B64 = '${sdlB64}'
(Invoke-WebRequest -UseBasicParsing ${url}).Content | bash`;
    return { posix, win };
  }

  async function createOrder({ product, minutes, userEmail }) {
    const r = await fetch("/api/compute/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, minutes, userEmail, promo }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || "order_failed");
    return data;
  }

  async function mintAfterPayment({ paymentId, product, minutes, email, promo }) {
    const r = await fetch
