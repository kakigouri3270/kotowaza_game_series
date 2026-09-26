import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "糠に釘 | ことわざ遊戯",
  description: "小さな部屋を一人称で歩いて、好きな場所へ糠に釘を刺す3Dゲーム。ぬるっと沈む釘を、ただ眺める自由なひととき。",
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
