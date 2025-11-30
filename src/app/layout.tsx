import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Liprobakin League",
  description: "Official Liprobakin basketball showcase inspired by the NBA G League layout.",
  metadataBase: new URL("https://liprobakin.local"),
  openGraph: {
    title: "Liprobakin League",
    description: "Scores, news, stats, and standings across the Liprobakin basketball association.",
    url: "https://liprobakin.local",
    siteName: "Liprobakin",
  },
  twitter: {
    card: "summary_large_image",
    title: "Liprobakin League",
    description: "Players, games, and stories shaping the Liprobakin season.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-transparent`}
      >
        {children}
      </body>
    </html>
  );
}
