import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "糠に釘 | ことわざ遊戯",
  description: "ただただ糠に釘を打つ3Dリズムゲーム。ぴったりの一打で、澄んだ音と連続ボーナス。60秒の記録をランキングへ。",
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
