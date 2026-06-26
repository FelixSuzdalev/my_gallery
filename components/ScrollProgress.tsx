'use client'

import { useEffect, useState } from 'react'

export default function ScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame = 0

    function updateProgress() {
      const scrollTop = window.scrollY
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      setProgress(Math.min(1, scrollTop / maxScroll))
    }

    function requestUpdate() {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(updateProgress)
    }

    frame = window.requestAnimationFrame(updateProgress)
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-[80] h-[3px] w-full">
      <div
        className="h-full origin-left bg-white mix-blend-difference"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  )
}
