import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "糠に釘 | ことわざ遊戯",
  description: "広い糠の回廊を一人称で歩き、三つの糠場へ自由に釘を刺す3Dゲーム。刺した本数を数えながら、沈み方と音の違いを楽しもう。",
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
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
