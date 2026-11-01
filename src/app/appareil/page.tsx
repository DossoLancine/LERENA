'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PairingScreen, adoptDeviceRole } from '@/components/devices/pairing-screen'

// Lien unique pour tout appareil (TV ou tablette) : il affiche un code ; le responsable choisit son rôle
// dans le tableau de bord, puis l'appareil bascule seul sur l'écran d'affichage ou sur la borne.
export default function DeviceSetupPage() {
  const router = useRouter()
  const onPaired = useCallback((status: Parameters<typeof adoptDeviceRole>[0]) => router.replace(adoptDeviceRole(status)), [router])
  return <PairingScreen type="ANY" onPaired={onPaired} />
}
