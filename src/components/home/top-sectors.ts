// Raccourcis de l'accueil : les secteurs qui comptent le plus d'établissements, du plus fourni au moins fourni
export function topSectors(orgs: { sectorSlug: string | null }[], sectors: { slug: string; name: string; icon: string }[]) {
  const count = new Map<string, number>()
  for (const o of orgs) if (o.sectorSlug) count.set(o.sectorSlug, (count.get(o.sectorSlug) ?? 0) + 1)
  return sectors
    .filter(s => count.has(s.slug))
    .sort((a, b) => (count.get(b.slug) ?? 0) - (count.get(a.slug) ?? 0))
    .map(s => ({ slug: s.slug, name: s.name, icon: s.icon }))
}
