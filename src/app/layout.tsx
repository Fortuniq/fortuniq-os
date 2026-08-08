import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const montserrat = localFont({
  src: "../fonts/Montserrat-VF.ttf",
  variable: "--font-montserrat",
  display: "swap",
  weight: "100 900",
});

const inter = localFont({
  src: "../fonts/Inter-VF.ttf",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "FortunIQ OS",
  description: "The internal operating system for FortunIQ Fuels.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
