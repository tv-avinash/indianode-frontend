// components/Footer.js
import Link from "next/link";

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid #e2e8f0",
        padding: "20px",
        textAlign: "center",
        marginTop: "40px",
        fontSize: "14px",
        color: "#475569",
      }}
    >
      <Link href="/about">About Us</Link> •{" "}
      <Link href="/contact">Contact Us</Link> •{" "}
      <Link href="/terms">Terms &amp; Conditions</Link> •{" "}
      <Link href="/privacy">Privacy Policy</Link> •{" "}
      <Link href="/refund">Cancellation &amp; Refund Policy</Link> •{" "}
      <Link href="/pricing">Pricing Policy</Link> •{" "}
      <Link href="/shipping">Shipping Policy</Link>
      <div style={{ marginTop: 10 }}>
        © {new Date().getFullYear()} Indianode Cloud
      </div>
    </footer>
  );
}
