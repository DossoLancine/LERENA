// Chargement d'un onglet : l'en-tête reste affiché, seul le contenu clignote
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-card bg-gray-200/80" />)}
      </div>
      <div className="h-64 animate-pulse rounded-card bg-gray-200/80" />
    </div>
  )
}
