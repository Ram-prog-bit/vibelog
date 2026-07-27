import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VibeLog — the flight recorder for AI agents",
    template: "%s · VibeLog",
  },
  description:
    "VibeLog is a local-first workspace for tracking every agent session: prompts, outputs, tool calls, cost, and performance. Your data never leaves your machine.",
};

// Runs before first paint, so it also marks the document as able to animate.
// Motion serialises its `initial` state into the SSR markup (opacity:0), and
// with scripting off nothing ever animates it back — the landing page shipped
// a nav, a footer and 2500px of nothing. globals.css forces reveal targets
// visible until this flag lands.
const THEME_INIT_SCRIPT = `(function(){try{var k="vibelog-theme",s=localStorage.getItem(k),t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){}document.documentElement.setAttribute("data-motion","on");})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
