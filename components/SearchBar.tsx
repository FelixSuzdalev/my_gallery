// components/SearchBar.tsx
'use client'
import React, { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

interface Props {
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  delay?: number // ms
  className?: string
  ariaLabel?: string
}

export default function SearchBar({ value = '', onChange, placeholder = 'Поиск...', delay = 300, className = '', ariaLabel = 'Поиск' }: Props) {
  const [local, setLocal] = useState(value)
  const ref = useRef<number | null>(null)

  useEffect(() => {
    setLocal(value)
  }, [value])

  useEffect(() => {
    if (ref.current) window.clearTimeout(ref.current)
    ref.current = window.setTimeout(() => {
      onChange(local.trim())
    }, delay)
    return () => {
      if (ref.current) window.clearTimeout(ref.current)
    }
  }, [local, onChange, delay])

  return (
    <div className={`relative flex-1 group ${className}`}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-black transition-colors" />
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        type="text"
        placeholder={placeholder}
        className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-white border-none rounded-full py-3 pl-12 pr-6 text-sm transition-all outline-none focus:ring-2 focus:ring-black"
        aria-label={ariaLabel}
      />
      {local && (
        <button
          onClick={() => { setLocal(''); onChange('') }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="Очистить поиск"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}