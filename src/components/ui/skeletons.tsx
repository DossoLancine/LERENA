// Squelettes affichés instantanément pendant le chargement d'une page,
// à la place d'un écran blanc ou d'un indicateur qui tourne.

function Bar({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />
}

export function ListPageSkeleton({ title = true }: { title?: boolean }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 pt-6 pb-4 space-y-3 border-b border-gray-100">
        {title && <Bar className="h-7 w-32" />}
        <Bar className="h-11 w-full" />
        <div className="flex gap-2">
          <Bar className="h-8 w-20" />
          <Bar className="h-8 w-20" />
          <Bar className="h-8 w-24" />
        </div>
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <Bar className="h-12 w-12 shrink-0" />
            <div className="flex-1 space-y-2">
              <Bar className="h-4 w-2/3" />
              <Bar className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DetailPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Bar className="h-56 w-full rounded-none" />
      <div className="-mt-6 space-y-4 rounded-t-3xl bg-gray-50 p-4">
        <Bar className="h-7 w-2/3" />
        <Bar className="h-4 w-1/2" />
        <div className="grid grid-cols-3 gap-3 pt-2">
          <Bar className="h-16" />
          <Bar className="h-16" />
          <Bar className="h-16" />
        </div>
        <Bar className="h-24 w-full" />
        <Bar className="h-24 w-full" />
      </div>
    </div>
  )
}

export function TicketSkeleton() {
  // Silhouette du suivi de ticket : en-tête, ticket à encoches, bloc « devant vous », étapes
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fde3cc] via-[#fff1e5] via-30% to-surface-sunken">
      <div className="mx-auto max-w-lg space-y-4 px-5 pt-5">
        <div className="flex justify-between"><Bar className="h-10 w-10 rounded-full" /><Bar className="h-10 w-24 rounded-full" /></div>
        <Bar className="h-[236px] w-full rounded-[28px]" />
        <Bar className="h-40 w-full rounded-[26px]" />
        <Bar className="h-16 w-full rounded-[22px]" />
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  // Même silhouette que la barre latérale : rien ne saute à l'arrivée des données
  return (
    <div className="min-h-screen bg-surface-sunken">
      <aside className="fixed inset-y-0 left-0 hidden w-64 space-y-3 border-r border-surface-line bg-white p-4 lg:block">
        <Bar className="h-9 w-40" />
        <Bar className="h-9 w-full" />
        <div className="space-y-2 pt-3">{Array.from({ length: 9 }, (_, i) => <Bar key={i} className="h-9 w-full" />)}</div>
      </aside>
      <div className="flex items-center gap-3 border-b border-surface-line bg-white px-4 py-3 lg:hidden">
        <Bar className="h-9 w-9" /><Bar className="h-8 w-40" />
      </div>
      <div className="lg:pl-64">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 lg:px-8 lg:py-7">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Bar key={i} className="h-28" />)}
          </div>
          <Bar className="h-64 w-full" />
        </div>
      </div>
    </div>
  )
}
