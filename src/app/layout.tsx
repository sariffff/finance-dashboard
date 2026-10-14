import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

// Covers both Thai and Latin glyphs, so Thai UI text renders consistently.
const plexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-sans",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finance Dashboard — สรุปรายรับรายจ่ายจาก statement ธนาคาร",
  description:
    "อัปโหลด statement ธนาคารไทย จัดหมวดหมู่อัตโนมัติ และดูสรุปรายจ่ายในที่เดียว",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${plexSansThai.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
