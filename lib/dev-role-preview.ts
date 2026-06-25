'use client'

import { useEffect, useState } from 'react'

export type PreviewRole = 'real' | 'user' | 'creator' | 'admin'

const STORAGE_KEY = 'my_gallery_dev_role_preview'
const EVENT_NAME = 'dev-role-preview:changed'

export function getEffectiveRole(realRole?: string | null, previewRole?: PreviewRole) {
  if (process.env.NODE_ENV !== 'development') return realRole ?? null
  if (!previewRole || previewRole === 'real') return realRole ?? null
  return previewRole
}

export function useDevRolePreview(realRole?: string | null) {
  const [previewRole, setPreviewRoleState] = useState<PreviewRole>('real')

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    function readPreviewRole() {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'user' || stored === 'creator' || stored === 'admin' || stored === 'real') {
        setPreviewRoleState(stored)
      } else {
        setPreviewRoleState('real')
      }
    }

    const timer = window.setTimeout(readPreviewRole, 0)
    window.addEventListener(EVENT_NAME, readPreviewRole)
    window.addEventListener('storage', readPreviewRole)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(EVENT_NAME, readPreviewRole)
      window.removeEventListener('storage', readPreviewRole)
    }
  }, [])

  function setPreviewRole(nextRole: PreviewRole) {
    if (process.env.NODE_ENV !== 'development') return
    window.localStorage.setItem(STORAGE_KEY, nextRole)
    setPreviewRoleState(nextRole)
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  }

  return {
    previewRole,
    effectiveRole: getEffectiveRole(realRole, previewRole),
    setPreviewRole,
  }
}
