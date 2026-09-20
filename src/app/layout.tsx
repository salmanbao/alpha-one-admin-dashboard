import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
