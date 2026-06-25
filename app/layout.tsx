// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

// Клиентские компоненты (они помечены 'use client' внутри своих файлов)
import Navbar from "@/components/Navbar";
import NagModal from "@/components/NagModal";
import Footer from "@/components/Footer"; // если хочешь Footer глобально; можно убрать, если используешь в page
import ScrollProgress from "@/components/ScrollProgress";
import DevRolePreview from "@/components/DevRolePreview";


export const metadata: Metadata = {
  title: "Creative Archive",
  description: "Виртуальная галерея для фотографов, художников и дизайнеров",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased">
        {/* глобальная оболочка: navbar всегда сверху, main растёт, footer фиксируется внизу */}
        <div className="min-h-screen flex flex-col bg-black text-white">
          <ScrollProgress />
          <Navbar />

          {/* main оставляем гибким для любой страницы */}
          <main className="flex-1">
            {children}
          </main>

          {/* глобальный футер (если не нужен глобально — можно удалить) */}
          <Footer />

          {/* модалка вынесена в layout — теперь её таймер/логика сработают надёжно */}
          <NagModal />
          <DevRolePreview />
        </div>
      </body>
    </html>
  );
}
