import type { Metadata } from "next";
import { Geist_Mono, Literata, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/platform/providers";
import { AppShell } from "@/components/shell/app-shell";

/* Material Symbols — the Stitch design language icon set (ligature font). */
const materialSymbols = `
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
  title: "TerraTrader — Trade. Grow. Get funded.",
  description:
    "TerraTrader dashboard — accounts, objectives, marketplace, trading, payouts and support.",
  keywords: ["TerraTrader", "trading", "forex", "funded", "challenge"],
  authors: [{ name: "TerraTrader" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "TerraTrader Dashboard",
    description: "Your evaluation accounts, objectives, trading and payouts in one place.",
    url: "https://trader.chat.z.ai",
    siteName: "TerraTrader",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TerraTrader Dashboard",
    description: "Your evaluation accounts, objectives, trading and payouts in one place.",
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
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        <style>
          {`
            .font-literate { font-family: var(--font-literata), Georgia, serif; }
          `}
        </style>
      </body>
    </html>
  );
}
