import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import VerificationNotification from "@/components/VerificationNotification";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import LiprobakinAI from "@/components/LiprobakinAI";
import { Analytics } from "@vercel/analytics/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: "Liprobakin | Official Basketball League",
    template: "%s | Liprobakin",
  },
  description: "Liprobakin - Official basketball league featuring teams, players, games, and standings. Watch live scores, news, and highlights from the Liprobakin basketball championship.",
  keywords: [
    "Liprobakin",
    "liprobakin",
    "librobakin",
    "Liprobakin League",
    "basketball",
    "basketball league",
    "sports",
    "teams",
    "players",
    "games",
    "scores",
    "standings",
    "basketball championship",
    "Congo basketball",
    "African basketball",
    "DRC basketball"
  ],
  authors: [{ name: "Liprobakin League" }],
  creator: "Liprobakin",
  publisher: "Liprobakin League",
  metadataBase: new URL("https://liprobakin.com"),
  alternates: {
    canonical: "https://liprobakin.com",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logos/liprobakin.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/logos/liprobakin.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Liprobakin | Official Basketball League",
    description: "Official Liprobakin basketball league - scores, news, stats, standings, teams, and players. Your source for all Liprobakin basketball action.",
    url: "https://liprobakin.com",
    siteName: "Liprobakin",
    images: [
      {
        url: "/logos/liprobakin.png",
        width: 1200,
        height: 630,
        alt: "Liprobakin Basketball League",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Liprobakin | Official Basketball League",
    description: "Official Liprobakin basketball league - Live scores, news, teams, and player stats.",
    images: ["/logos/liprobakin.png"],
    creator: "@liprobakin",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "bfe_Y0iCyzUhcJRSQivgLN9bN9KRybWTLZ-2YflX3Gc",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    "name": "Liprobakin",
    "alternateName": ["Liprobakin League", "Librobakin"],
    "url": "https://liprobakin.com",
    "logo": {
      "@type": "ImageObject",
      "url": "https://liprobakin.com/logos/liprobakin.png",
      "width": "512",
      "height": "512"
    },
    "image": "https://liprobakin.com/logos/liprobakin.png",
    "description": "Official Liprobakin basketball league featuring teams, players, games, and standings.",
    "sport": "Basketball",
    "sameAs": [
      "https://www.facebook.com/Liprobakin-League"
    ]
  };

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-transparent`}
      >
        {/* JSON-LD Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        
        {/* Google AdSense - Replace ca-pub-XXXXX with your AdSense ID */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6159195090622597"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        
        {/* Meta Pixel Code - Replace with your actual Facebook Pixel ID */}
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', 'YOUR_PIXEL_ID');
              fbq('track', 'PageView');
            `,
          }}
        />
        <noscript>
          <img 
            height="1" 
            width="1" 
            style={{display: 'none'}}
            src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID&ev=PageView&noscript=1" 
          />
        </noscript>
        
        <LanguageProvider>
          <AuthProvider>
            <AnalyticsProvider>
              <VerificationNotification />
              {children}
              <LiprobakinAI />
              <Analytics />
            </AnalyticsProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
