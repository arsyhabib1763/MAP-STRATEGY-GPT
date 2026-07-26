import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (host?.startsWith("localhost") ? "http" : "https");
  const safeHost = host?.replace(/[^a-zA-Z0-9.:[\]-]/g, "");
  const origin = safeHost ? `${protocol}://${safeHost}` : "http://localhost:3000";
  const description =
    "Susun, visualisasikan, dan audit strategi berbasis waktu, alur, atau target besar.";

  return {
    title: "SIMPUL — AI Strategy Studio",
    description,
    icons: {
      icon: "/og.png",
      shortcut: "/og.png",
    },
    openGraph: {
      title: "SIMPUL — AI Strategy Studio",
      description,
      type: "website",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: "SIMPUL — Strategi yang bisa disentuh.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "SIMPUL — AI Strategy Studio",
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
