'use client'

import {
  Download,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react'
import { useSettings } from '../_components/settings-provider'

export default function DataSettingsPage() {
  const { resettingQueue, exportingCsv, handleResetQueue, handleExportCSV } = useSettings()

  return (
    <div className="space-y-6">
      {/* Export CSV */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-green-600" size={20} />
            <h3 className="font-bold text-gray-900 text-base">Exportation des Données (CSV)</h3>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-lg leading-relaxed">
            Téléchargez l'historique complet des tickets avec les heures d'arrivée, de prise en charge,
            les services, les statuts et les avis clients (NPS) pour analyse sous Excel ou Google Sheets.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={exportingCsv}
          className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-green-700 active:scale-95 transition-all shadow-md shadow-green-200 disabled:opacity-50 whitespace-nowrap"
        >
          <Download size={15} />
          {exportingCsv ? 'Génération...' : 'Exporter les Tickets (CSV)'}
        </button>
      </div>

      {/* Réinitialisation de la file */}
      <div className="bg-white rounded-3xl border border-red-100 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <RefreshCw className="text-red-500" size={20} />
            <h3 className="font-bold text-gray-900 text-base">Réinitialisation Quotidienne de la File</h3>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-lg leading-relaxed">
            Clôture instantanément tous les tickets encore marqués "En attente" ou "Appelé". Utilisez ce bouton à la
            fermeture de l'établissement pour repartir sur une file vierge le lendemain matin.
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetQueue}
          disabled={resettingQueue}
          className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-red-600 hover:text-white active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw size={15} className={resettingQueue ? 'animate-spin' : ''} />
          {resettingQueue ? 'Réinitialisation...' : 'Remettre la File à Zéro'}
        </button>
      </div>
    </div>
  )
}
