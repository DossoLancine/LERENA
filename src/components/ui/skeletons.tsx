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
  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-4">
      <Bar className="h-6 w-40" />
      <div className="rounded-3xl bg-white p-6 shadow-sm space-y-4 flex flex-col items-center">
        <Bar className="h-4 w-24" />
        <Bar className="h-16 w-36" />
        <Bar className="h-40 w-40 rounded-full" />
        <Bar className="h-4 w-48" />
      </div>
      <Bar className="h-20 w-full" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-6 py-4 space-y-4 border-b border-gray-100">
        <div className="flex justify-between">
          <Bar className="h-8 w-48" />
          <Bar className="h-8 w-24" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 6 }, (_, i) => <Bar key={i} className="h-9 w-24" />)}
        </div>
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Bar key={i} className="h-28" />)}
        </div>
        <Bar className="h-64 w-full" />
      </div>
    </div>
  )
}
