'use client'

import {
  Save,
  Phone,
  Mail,
  MapPin
} from 'lucide-react'
import { useSettings } from '../_components/settings-provider'
import { BrandingCard } from '@/components/branding/branding-card'

export default function SiteSettingsPage() {
  const { saving, formData, setFormData, handleSaveProfile, sectors } = useSettings()

  return (
    <div className="space-y-4">
    <BrandingCard />
    <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl border border-gray-100 p-6 space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h2 className="text-base font-bold text-gray-900">Coordonnées de l'Établissement</h2>
          <p className="text-xs text-gray-500 mt-0.5">Ces informations apparaissent sur le ticket digital des clients.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={e => setFormData(f => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 text-orange-500 rounded focus:ring-orange-400"
            />
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${formData.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {formData.isActive ? 'Établissement Ouvert' : 'Établissement Fermé'}
            </span>
          </label>
        </div>
      </div>

      {/* Mode de réservation (Ticket / RDV / Hybride) */}
      <div className="p-5 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            🗓️ Mode de réservation des clients
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Choisissez comment vos clients peuvent rejoindre votre file sur l'application.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { value: 'QUEUE_ONLY', label: '🎟️ Ticket immédiat', desc: 'Les clients prennent uniquement un numéro de file. Idéal pour les fast-foods, pharmacies.' },
            { value: 'HYBRID', label: '🔀 Hybride', desc: 'Les clients choisissent entre un ticket immédiat ou un rendez-vous planifié.' },
            { value: 'APPOINTMENT_ONLY', label: '📅 Sur rendez-vous', desc: 'Uniquement des créneaux réservés à l\'avance. Idéal pour médecins, salons de coiffure.' },
          ].map(opt => (
            <label
              key={opt.value}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.bookingMode === opt.value ? 'border-orange-500 bg-orange-50 text-orange-950' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm">{opt.label}</span>
                <input
                  type="radio"
                  name="bookingMode"
                  value={opt.value}
                  checked={formData.bookingMode === opt.value}
                  onChange={e => setFormData(f => ({ ...f, bookingMode: e.target.value }))}
                  className="w-4 h-4 text-orange-500"
                />
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">{opt.desc}</p>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Nom de l'établissement *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
            placeholder="Ex: Hôpital Mère-Enfant"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Secteur d'activité
          </label>
          <select
            value={formData.sectorId}
            onChange={e => setFormData(f => ({ ...f, sectorId: e.target.value }))}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
          >
            {!formData.sectorId && <option value="">Choisir un secteur…</option>}
            {sectors.map(sec => (
              <option key={sec.id} value={sec.id}>{sec.name}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Description / Message d'accueil
          </label>
          <textarea
            rows={2}
            value={formData.description}
            onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all resize-none"
            placeholder="Ex: Consultations générales et spécialisées sans rendez-vous."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Adresse physique
          </label>
          <div className="relative">
            <MapPin size={16} className="absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={formData.address}
              onChange={e => setFormData(f => ({ ...f, address: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
              placeholder="Ex: Rue des Jardins, Cocody"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Ville / Commune
          </label>
          <input
            type="text"
            value={formData.city}
            onChange={e => setFormData(f => ({ ...f, city: e.target.value }))}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
            placeholder="Ex : ville du site"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Téléphone de contact
          </label>
          <div className="relative">
            <Phone size={16} className="absolute left-3.5 top-3 text-gray-400" />
            <input
              type="tel"
              value={formData.phone}
              onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
              placeholder="Ex: +225 07 00 00 00 00"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Email professionnel
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-3 text-gray-400" />
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
              placeholder="Ex: contact@hopital.com"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-orange-500 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-orange-600 transition-all text-sm shadow-md shadow-orange-200 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </button>
      </div>
    </form>
    </div>
  )
}
