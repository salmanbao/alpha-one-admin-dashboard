import type { Metadata } from "next";
import { Geist, Geist_Mono, Literata, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const materialSymbols = `
  @font-face {
    font-family: 'Material Symbols Outlined';
    font-style: normal;
    src: url(https://fonts.gstatic.com/s/materialsymbolsoutlined/v201/kjeNqXKwxOnMGvHPOFjLd2gLtD5hA.woff2) format('woff2');
    font-display: block;
  }
  .ms-icon {
    font-family: 'Material Symbols Outlined';
    font-weight: normal;
    font-style: normal;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-smoothing: antialiased;
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }
`;

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
  title: "PFaaS Platform Admin",
  description: "PFaaS platform administration console for super admins.",
  keywords: ["PFaaS", "platform admin", "super admin", "dashboard"],
  authors: [{ name: "PFaaS Platform" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "PFaaS Platform Admin",
    description: "Platform administration console.",
    url: "https://chat.z.ai",
    siteName: "PFaaS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PFaaS Platform Admin",
    description: "Platform administration console.",
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
        <style dangerouslySetInnerHTML={{ __html: materialSymbols }} />
        <div className="bg-foreground text-background px-4 py-1 text-xs text-center font-medium">
          PFaaS Platform Admin — Super Admin Console
        </div>
        {children}
        <Toaster />
      </body>
    </html>
  );
}