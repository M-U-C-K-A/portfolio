import type { Metadata } from "next";
import { Geist_Mono, Inter_Tight } from "next/font/google";
import { site } from "@/lib/content";
import "./globals.css";

const display = Inter_Tight({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.role}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.role}`,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.role}`,
    description: site.description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      {/*
        `overflow-x-clip` et non `hidden` : `hidden` force le calcul de
        `overflow-y` à `auto`, ce qui transforme le body en conteneur de
        défilement autonome et empêche la molette de remonter jusqu'au viewport.
        `clip` borne le débordement horizontal sans créer ce conteneur.
      */}
      <body className="flex min-h-dvh flex-col overflow-x-clip">
        <a
          href="#contenu"
          className="label sr-only rounded-none focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:bg-ink focus-visible:px-3 focus-visible:py-2 focus-visible:text-paper"
        >
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
