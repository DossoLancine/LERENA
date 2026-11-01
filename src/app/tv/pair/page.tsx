'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PairingScreen } from '@/components/devices/pairing-screen'

// Une TV qui ouvre cette adresse affiche un code ; une fois appairée, elle affiche la file de l'établissement
export default function TvPairPage() {
  const router = useRouter()
  const onPaired = useCallback(({ orgId }: { orgId: string }) => router.replace(`/tv/${orgId}`), [router])
  return <PairingScreen type="TV" onPaired={onPaired} />
}
