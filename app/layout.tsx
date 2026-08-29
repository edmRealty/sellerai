import "./globals.css";

const googleAnalyticsId = "G-K0ZSN5QT8S";

export const metadata = {
  metadataBase: new URL("https://seller.housingpa.com"),
  title: {
    default: "What Property You'd like to sell? | SellerAI",
    template: "%s | SellerAI"
  },
  description: "List your property step by step with Beny Hen and Quinn & Wilson through an AI-assisted seller workflow.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "What Property You'd like to sell? | SellerAI",
    description: "A step-by-step, broker-supported property listing workflow with Quinn & Wilson.",
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
