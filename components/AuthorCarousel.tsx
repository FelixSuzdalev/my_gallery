'use client'
import React from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'

interface Props {
  images: string[]
}

export default function AuthorCarousel({ images }: Props) {
  // Настройка: карусель будет медленно крутиться сама
  const [emblaRef] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 3000 })])

  return (
    <div className="overflow-hidden bg-gray-100 rounded-lg" ref={emblaRef}>
      <div className="flex">
        {images.map((src, index) => (
          <div className="flex-[0_0_100%] min-w-0 relative h-64" key={index}>
            <img 
              src={src} 
              alt="work" 
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  )
}