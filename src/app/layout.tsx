import type { Metadata } from "next";
import { Geist, Geist_Mono, Literata, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PFaaS Platform — Prop Firm as a Service",
  description: "Multi-tenant white-label prop firm dashboard platform with dynamic modules, widgets, and permissions.",
  keywords: ["PFaaS", "prop firm", "multi-tenant", "white-label", "dashboard", "modules"],
  authors: [{ name: "PFaaS Platform" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "PFaaS Platform",
    description: "Multi-tenant white-label prop firm dashboard platform.",
    url: "https://chat.z.ai",
    siteName: "PFaaS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PFaaS Platform",
    description: "Multi-tenant white-label prop firm dashboard platform.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${literata.variable} ${nunitoSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
