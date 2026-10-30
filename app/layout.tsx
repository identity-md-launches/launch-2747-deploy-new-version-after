import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wheelkeepers — A little hamster. A big high score.",
  description: "Catch seeds. Dodge glitches. Keep the wheel alive. A free Squeekchain arcade with gasless wallet sign-in and a shared leaderboard.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
