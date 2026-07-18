import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about SellerAI, HousingPA's broker-led seller workflow.",
};

export default function AboutPage() {
  return (
    <main style={{ margin: "0 auto", maxWidth: 900, padding: "48px 24px 72px" }}>
      <a href="/" style={{ color: "#0f766e", fontWeight: 700, textDecoration: "none" }}>
        SellerAI
      </a>
      <p
        style={{
          color: "#0f766e",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.08em",
          margin: "44px 0 12px",
          textTransform: "uppercase",
        }}
      >
        About
      </p>
      <h1
        style={{
          fontFamily: '"Playfair Display", serif',
          fontSize: "clamp(40px, 7vw, 68px)",
          lineHeight: 1.02,
          margin: "0 0 24px",
        }}
      >
        A clearer way to prepare a home for sale.
      </h1>
      <p style={{ color: "#475569", fontSize: 20, lineHeight: 1.6, maxWidth: 720 }}>
        SellerAI is a HousingPA workflow for gathering property details, organizing preparation steps, and giving
        sellers a clearer view of what comes next before listing.
      </p>
      <section style={{ borderTop: "1px solid #e2e8f0", display: "grid", gap: 20, marginTop: 48, paddingTop: 32 }}>
        <div>
          <h2 style={{ fontSize: 22, margin: "0 0 8px" }}>Seller-led preparation</h2>
          <p style={{ color: "#475569", margin: 0 }}>
            Sellers provide the facts, photos, documents, and preferences that make a listing easier to prepare
            accurately.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, margin: "0 0 8px" }}>Broker-led review</h2>
          <p style={{ color: "#475569", margin: 0 }}>
            A licensed real-estate professional remains involved in the review, listing process, and required
            transaction steps.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, margin: "0 0 8px" }}>Better context, not a promise</h2>
          <p style={{ color: "#475569", margin: 0 }}>
            SellerAI organizes pricing inputs and market context. It does not provide a final valuation, guarantee a
            sale price, or replace professional advice.
          </p>
        </div>
      </section>
      <p style={{ marginTop: 48 }}>
        <a href="/" style={{ color: "#0f766e", fontWeight: 700 }}>
          Start a seller review
        </a>{" "}
        <span style={{ color: "#64748b" }}>or</span>{" "}
        <a href="mailto:ben@housingpa.com" style={{ color: "#0f766e", fontWeight: 700 }}>
          contact HousingPA
        </a>
        .
      </p>
    </main>
  );
}
