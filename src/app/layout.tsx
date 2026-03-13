import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Spotlight — Launch videos & interactive demos in minutes",
  description:
    "Open-source platform for product launches. Cinematic videos, interactive click-through demos, screen recording enhancement, hotspots, callouts, chapters, embeddable player — all in your browser.",
  keywords: [
    "product launch video",
    "interactive demo",
    "screen recording",
    "product tour",
    "click-through demo",
    "arcade alternative",
    "product hunt",
    "open source",
    "canvas rendering",
    "embeddable player",
  ],
  authors: [{ name: "Spotlight" }],
  openGraph: {
    title: "Spotlight — Launch videos & interactive demos",
    description:
      "Open-source platform for product launches. Cinematic videos, interactive demos, screen recording enhancement — all in your browser.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spotlight — Launch videos & interactive demos",
    description:
      "Open-source platform for product launches. Videos, interactive demos, and screen recording enhancement.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-surface-0 text-zinc-100 font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
