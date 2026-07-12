import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeApplier } from "@/components/ThemeApplier";
import { SoundBoot } from "@/components/sound/SoundBoot";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Encore — Live Competition OS",
  description:
    "Build, host and run live competitions — quizzes, antakshari, drawing rounds — synced to every phone in the room.",
};

const NO_FLASH_THEME_SCRIPT = `(function(){try{var raw=localStorage.getItem("encore-settings");var mode=raw&&JSON.parse(raw).state&&JSON.parse(raw).state.mode;document.documentElement.setAttribute("data-theme",mode==="bright"?"bright":"dark");}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The no-flash theme script below sets data-theme on this element
      // synchronously before hydration, by design — the server can't know the
      // visitor's persisted theme choice, so a mismatch here is expected and
      // harmless. Silence the warning for this element only.
      suppressHydrationWarning
    >
      <head>
        {/* Reads the persisted theme choice before first paint so switching
            to the bright theme never flashes the default dark theme. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col enc-page-glow">
        <ThemeApplier />
        <SoundBoot />
        {children}
      </body>
    </html>
  );
}
