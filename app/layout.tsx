// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

import Navbar from "@/components/Navbar";
import NagModal from "@/components/NagModal";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import DemoRoleSwitcher from "@/components/DemoRoleSwitcher";

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
        <div className="min-h-screen flex flex-col bg-black text-white">
          <ScrollProgress />
          <Navbar />

          <main className="flex-1">
            {children}
          </main>

          <Footer />
          <NagModal />
          <DemoRoleSwitcher />
        </div>
      </body>
    </html>
  );
}