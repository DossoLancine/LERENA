'use client'

import {
  ExternalLink,
  Copy,
  Printer,
  Download,
  Clock
} from 'lucide-react'
import { useSettings } from '../_components/settings-provider'

export default function PosterSettingsPage() {
  const { org, qrCodeDataUrl, copiedUrl, printRef, handlePrintPoster, copyToClipboard, clientPageUrl } = useSettings()

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Carte Affiche Print Preview */}
          <div
            ref={printRef}
            className="w-full max-w-sm bg-white border-2 border-dashed border-orange-200 p-6 rounded-3xl text-center shadow-lg print:border-none print:shadow-none"
          >
            <div className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold mb-3 uppercase tracking-wider">
              <Clock size={14} /> Service Rapide
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {org?.logo && <img src={org.logo} alt="" className="mx-auto mb-2 h-16 w-auto object-contain" />}
            <h3 className="text-xl font-black text-gray-900 mb-1">{org?.name}</h3>
            <p className="text-xs text-gray-500 mb-5">Scannez pour prendre votre ticket sans attendre</p>

            {qrCodeDataUrl ? (
              <div className="bg-white p-3 rounded-2xl shadow-inner inline-block border border-gray-100 mb-4">
                <img src={qrCodeDataUrl} alt="QR Code d'accès" className="w-56 h-56 mx-auto rounded-xl" />
              </div>
            ) : (
              <div className="w-56 h-56 bg-gray-100 rounded-xl mx-auto flex items-center justify-center text-gray-400">
                Génération QR...
              </div>
            )}

            <div className="bg-orange-50 rounded-2xl p-3.5 text-orange-900 text-xs font-medium space-y-1">
              <p className="font-bold text-orange-700">1. Pointez votre appareil photo</p>
              <p>2. Choisissez votre service</p>
              <p>3. Suivez votre tour en temps réel</p>
            </div>
            <p className="text-[10px] text-gray-400 mt-4 tracking-widest uppercase">Propulsé par Lerena</p>
          </div>

          {/* Actions & Instructions */}
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Affiche d'accueil pour la porte d'entrée</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Imprimez cette affiche et collez-la à l'entrée ou au comptoir. Les clients scannent le QR Code
                avec leur téléphone pour obtenir leur ticket instantanément. Zéro papier, zéro borne tactile à acheter.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/70 space-y-2">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Lien direct vers votre borne :</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  aria-label="Lien de l’établissement"
                  value={clientPageUrl}
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-600 truncate"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(clientPageUrl)}
                  className="flex items-center gap-1 bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  <Copy size={13} />
                  {copiedUrl ? 'Copié !' : 'Copier'}
                </button>
                <a
                  href={clientPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600"
                  title="Tester la page client"
                >
                  <ExternalLink size={15} />
                </a>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={handlePrintPoster}
                className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold text-xs hover:bg-orange-600 transition-all shadow-md shadow-orange-200"
              >
                <Printer size={16} />
                Imprimer l'Affiche A4
              </button>

              {qrCodeDataUrl && (
                <a
                  href={qrCodeDataUrl}
                  download={`qrcode_attends_${org?.name.toLowerCase().replace(/\s+/g, '_')}.png`}
                  className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-xs hover:bg-gray-50 transition-all"
                >
                  <Download size={16} />
                  Télécharger le QR Code PNG
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
