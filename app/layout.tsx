import "./globals.css";

const googleAnalyticsId = "G-K0ZSN5QT8S";

export const metadata = {
  metadataBase: new URL("https://seller.housingpa.com"),
  title: {
    default: "SellerAI | Housing Pro Assets",
    template: "%s | SellerAI"
  },
  description: "SellerAI is part of Housing Pro Assets: AI-assisted seller reports, pricing strategy, listing preparation, seller documents, and broker-led workflows.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "SellerAI | Housing Pro Assets",
    description: "AI-assisted seller reports, pricing strategy, listing preparation, and broker-led seller workflows.",
    url: "https://seller.housingpa.com/",
    siteName: "SellerAI by Housing Pro Assets",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "SellerAI",
    description: "AI-assisted seller workflows from Housing Pro Assets."
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${googleAnalyticsId}');`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
