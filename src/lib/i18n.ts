import fr from '../../messages/fr.json'

// Textes de l'interface. Le français est la langue de référence ; ajouter une langue =
// ajouter messages/<code>.json avec les mêmes clés.
// Usage : t('dashboard.kpi.waiting')  ou  t('common.minutes', { count: 12 })

type Messages = typeof fr

// Toutes les clés valides, sous forme « section.sous_section.cle » (vérifiées par TypeScript)
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]

export type MessageKey = Leaves<Messages>

const dictionaries: Record<string, Messages> = { fr }
const locale = 'fr'

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const value = key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    dictionaries[locale]
  )
  if (typeof value !== 'string') return key
  return vars ? value.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`)) : value
}
