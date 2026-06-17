import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Playlist Arena",
  description: "Spotify playlist tournament app with incremental playlist sync"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
