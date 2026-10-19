import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WindowName } from "@/components/WindowName";
import { ThemeProvider } from "@/components/ThemeProvider";

// Variable Archivo with the width axis, so headings can run semi-expanded
// (see the `font-display` utility in globals.css).
const archivo = Archivo({
  variable: "--font-sans",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CourtFit — Badminton Facility Analyzer",
  description: "Evaluate commercial properties for badminton club viability",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <WindowName name="kotofit-app" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
