import type { Metadata, Viewport } from "next";
import "./globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
