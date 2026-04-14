import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PitchPerfect - AI-Powered Investor Pitch Practice",
  description:
    "Practice your investor pitch with AI-powered feedback. Get scored on clarity, authority, energy, and more. Master the art of handling investor questions.",
  keywords: [
    "pitch practice",
    "investor pitch",
    "startup pitch",
    "pitch feedback",
    "founder training",
    "pitch coaching",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
