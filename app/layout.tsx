import type { Metadata } from "next";
import "./globals.css";
import { extensionErrorPrelude } from "@/scripts/dev-extension-errors.mjs";

export const metadata: Metadata = {
  title: "Wheelkeepers | Keep the wheel alive",
  description: "A Squeekchain arcade powered by a real hamster. Catch seeds, dodge glitches and play free. Live Boost events and a shared leaderboard.",
  icons: {
    icon: "./hamster-mark.svg",
    shortcut: "./hamster-mark.svg",
  },
  openGraph: {
    title: "Wheelkeepers | Keep the wheel alive",
    description: "A real hamster. A shared high score. Play the free Squeekchain arcade.",
    images: [{ url: "./share.png", width: 1200, height: 630, alt: "Wheelkeepers hamster wheel arcade" }],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {process.env.NODE_ENV === "development" && (
          <script id="wheelkeepers-extension-error-filter" dangerouslySetInnerHTML={{ __html: extensionErrorPrelude }} />
        )}
        {children}
      </body>
    </html>
  );
}
