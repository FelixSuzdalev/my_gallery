// components/ImageLightbox.tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export default function ImageLightbox({ src, alt, onClose }: { src: string | null, alt?: string, onClose: () => void }) {
  return (
    <AnimatePresence>
      {src && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
          <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.98 }} className="relative max-w-4xl w-full">
            <button onClick={onClose} className="absolute right-3 top-3 z-50 bg-white/10 hover:bg-white/20 rounded-full p-2">
              <X size={18} />
            </button>
            <motion.img src={src!} alt={alt} className="w-full h-auto max-h-[80vh] object-contain rounded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
