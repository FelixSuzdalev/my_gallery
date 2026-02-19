// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Клиентские компоненты (они помечены 'use client' внутри своих файлов)
import Navbar from "@/components/Navbar";
import NagModal from "@/components/NagModal";
import Footer from "@/components/Footer"; // если хочешь Footer глобально; можно убрать, если используешь в page

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Virtual Gallery",
  description: "Виртуальная галерея для фотографов, художников и дизайнеров",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* глобальная оболочка: navbar всегда сверху, main растёт, footer фиксируется внизу */}
        <div className="min-h-screen flex flex-col bg-black text-white">
          <Navbar />

          {/* main оставляем гибким для любой страницы */}
          <main className="flex-1">
            {children}
          </main>

          {/* глобальный футер (если не нужен глобально — можно удалить) */}
          <Footer />

          {/* модалка вынесена в layout — теперь её таймер/логика сработают надёжно */}
          <NagModal />
        </div>
      </body>
    </html>
  );
}

