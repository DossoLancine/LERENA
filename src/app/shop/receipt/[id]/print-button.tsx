'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-control border border-gray-200 py-2.5 text-sm font-semibold text-ink print:hidden">
      <Printer size={15} /> Imprimer ou PDF
    </button>
  )
}
