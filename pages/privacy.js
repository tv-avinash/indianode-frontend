export default function Privacy() {
  return (
    <div style={{ maxWidth: "820px", margin: "40px auto", padding: "24px" }}>
      <h1>Privacy Policy</h1>
      <p><strong>Effective Date:</strong> 10 Sep 2025</p>

      <p>
        At <strong>Indianode Cloud</strong>, your privacy matters. This policy explains what we
        collect and how we use it.
      </p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>Account data (name, email, phone) when you register or pay.</li>
        <li>Billing details required to process payments via Razorpay.</li>
        <li>Usage logs (IP, timestamps, resource utilization) to run and secure the service.</li>
        <li>Support communications you send to us.</li>
      </ul>

      <h2>2. How We Use Data</h2>
      <ul>
        <li>To provide and improve services, and for customer support.</li>
        <li>To process payments, prevent fraud, and meet legal obligations.</li>
        <li>To communicate service updates where appropriate.</li>
      </ul>

      <h2>3. Sharing</h2>
      <ul>
        <li>We do not sell personal data.</li>
        <li>
          We may share limited data with service providers (e.g., Razorpay, hosting/analytics)
          under appropriate safeguards.
        </li>
      </ul>

      <h2>4. Security</h2>
      <p>Payments use SSL and PCI-DSS compliant gateways. No system is 100% secure, but we take reasonable steps to protect data.</p>

      <h2>5. Data Retention &amp; Your Rights</h2>
      <p>
        We retain data while your account is active or as required by law. You may request
        access, correction, or deletion via{" "}
        <a href="mailto:support@indianode.com">support@indianode.com</a>.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions, email <a href="mailto:support@indianode.com">support@indianode.com</a>.
      </p>
    </div>
  );
}
