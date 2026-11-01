'use server'

import { getActiveSectors, getPlatformConfig } from '@/lib/platform'

// Lecture publique (sans données sensibles) des réglages et des secteurs, pour les pages côté navigateur

export async function getPublicConfig() {
  const config = await getPlatformConfig()
  return {
    appName: config.appName,
    defaultCountryCode: config.defaultCountryCode,
    defaultCity: config.defaultCity,
    defaultLat: config.defaultLat,
    defaultLng: config.defaultLng,
    demoMode: config.demoMode
  }
}

export async function getSectors() {
  return getActiveSectors()
}
