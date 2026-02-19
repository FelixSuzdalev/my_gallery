import type { NextConfig } from "next";

// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Прописать домены, откуда будут грузиться внешние картинки
    domains: [
      'encrypted-tbn0.gstatic.com',
      'picsum.photos',
      'lh3.googleusercontent.com',
      'your-supabase-bucket.supabase.co' // <- замени на свой bucket, если используешь Supabase
    ],
    // Альтернатива: remotePatterns даёт большую гибкость
    // remotePatterns: [
    //   { protocol: 'https', hostname: 'picsum.photos' },
    //   { protocol: 'https', hostname: '*.gstatic.com' },
    // ],
  },

  // (Если ты тестируешь с другого устройства по локальной сети)
  experimental: {
    // allowedDevOrigins: ['http://192.168.0.102:3000'],
  },
}


module.exports = nextConfig

export default nextConfig;
