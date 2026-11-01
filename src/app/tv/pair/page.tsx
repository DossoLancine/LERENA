'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PairingScreen, adoptDeviceRole } from '@/components/devices/pairing-screen'

// Ancienne adresse des TV, toujours valable : une fois appairé, l'appareil prend le rôle choisi au tableau de bord
export default function TvPairPage() {
  const router = useRouter()
  const onPaired = useCallback((status: Parameters<typeof adoptDeviceRole>[0]) => router.replace(adoptDeviceRole(status)), [router])
  return <PairingScreen type="TV" onPaired={onPaired} />
}
