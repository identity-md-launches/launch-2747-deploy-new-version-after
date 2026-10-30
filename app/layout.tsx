import type { Metadata } from "next";
import "./globals.css";
import { extensionErrorPrelude } from "@/scripts/dev-extension-errors.mjs";

export const metadata: Metadata = {
  title: "Wheelkeepers — A little hamster. A big high score.",
  description: "Catch seeds. Dodge glitches. Keep the wheel alive. A free Squeekchain arcade with gasless wallet sign-in and a shared leaderboard.",
  icons: {
    icon: "/hamster-mark.svg?v=led-ears",
    shortcut: "/hamster-mark.svg?v=led-ears",
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
