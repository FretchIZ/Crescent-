import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

// All pages read live catalog/session data; never prerender against a build-time database.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Brandmark — AI product & service discovery",
    template: "%s · Brandmark",
  },
  description:
    "Describe what you want in plain language. Brandmark understands your intent, searches products and services together, and explains every match.",
  applicationName: "Brandmark",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f4f4f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
