import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "@/app/globals.css";
import { JustAskCopilotProvider } from "@/components/justask/CopilotProvider";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const serif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Luma Salon — Book your appointment",
  description: "Modern cuts, thoughtful care, and effortless booking.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable}`}>
        <JustAskCopilotProvider>{children}</JustAskCopilotProvider>
      </body>
    </html>
  );
}
