import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Nunito } from "next/font/google";
import { siteConfig } from "@/config/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: `Catálogo, pedidos y análisis comercial de ${siteConfig.name}.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={siteConfig.locale}
      className={`${inter.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
