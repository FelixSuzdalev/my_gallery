import { Suspense } from 'react'
import CheckEmailClient from './CheckEmailClient'

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white p-6 text-black">Загрузка...</div>}>
      <CheckEmailClient />
    </Suspense>
  )
}
