import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/platform/providers";
import { AppShell } from "@/components/shell/app-shell";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trader — PFaaS Trading Workspace",
  description: "Your personal trading dashboard — My Workspace, My Open Positions, My Closed Positions",
  keywords: ["PFaaS", "trading", "forex", "workspace", "positions"],
  authors: [{ name: "PFaaS Platform" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Trader Dashboard",
    description: "Personal trading workspace with open and closed positions.",
    url: "https://trader.chat.z.ai",
    siteName: "Trader",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trader Dashboard",
    description: "Personal trading workspace with open and closed positions.",
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
        className={`${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}