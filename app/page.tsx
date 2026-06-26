// app/page.tsx
import Hero from '@/components/Hero'
import PlatformFeatures from '@/components/PlatformFeatures'
import FeaturedCollections from '@/components/FeaturedCollections'
import V2Home from '@/components/V2Home'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

export default function Home() {
  if (isSupabaseV2) return <V2Home />

  return (
    <main className="min-h-screen bg-black text-white">
      <Hero />
      <PlatformFeatures />
      <FeaturedCollections />
    </main>
  )
}