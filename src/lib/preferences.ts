'use client'

// Préférences d'affichage de l'usager, gardées sur son appareil et appliquées dès le chargement
// (voir le script dans app/layout.tsx, qui évite tout clignotement).

export type TextSize = 'normal' | 'large' | 'xlarge'

export interface Preferences {
  textSize: TextSize
  highContrast: boolean
}

export const PREFS_KEY = 'attends_prefs'
export const TEXT_SIZES: Record<TextSize, string> = { normal: '16px', large: '18px', xlarge: '20px' }

export function readPreferences(): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    return { textSize: p.textSize in TEXT_SIZES ? p.textSize : 'normal', highContrast: !!p.highContrast }
  } catch {
    return { textSize: 'normal', highContrast: false }
  }
}

export function applyPreferences(p: Preferences) {
  const root = document.documentElement
  root.style.fontSize = TEXT_SIZES[p.textSize]
  root.classList.toggle('high-contrast', p.highContrast)
}

export function savePreferences(p: Preferences) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)) } catch {}
  applyPreferences(p)
}
