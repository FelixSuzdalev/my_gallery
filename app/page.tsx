// app/page.tsx
import Hero from '@/components/Hero'
import PlatformFeatures from '@/components/PlatformFeatures'
import FeaturedCollections from '@/components/FeaturedCollections'

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <Hero />
      <PlatformFeatures />
      <FeaturedCollections />
    </main>
  )
}
