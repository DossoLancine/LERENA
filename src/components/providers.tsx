'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/toast'

export function NextAuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  )
}
