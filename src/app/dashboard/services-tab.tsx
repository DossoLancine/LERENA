'use client'

import { useState, useEffect } from 'react'
import { Plus, Settings, CheckCircle2, Clock, Users, Trash2, Power, AlertCircle, Sparkles } from 'lucide-react'
import { getOrganizationServices } from '../actions/manager'
import { createOrganizationService, toggleServiceStatus, deleteOrganizationService } from '../actions/services'

export default function ServicesTab() {
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    prefix: '',
    avgDurationMin: 15,
    description: ''
  })

  const loadServices = async () => {
    try {
      const data = await getOrganizationServices()
      setServices(data || [])
    } catch (e) {
      console.error("Error loading services:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServices()
    const interval = setInterval(loadServices, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return

    setSubmitting(true)
    setErrorMsg(null)

    const res = await createOrganizationService({
      name: form.name.trim(),
      prefix: form.prefix.trim() || form.name[0].toUpperCase(),
      avgDurationMin: Number(form.avgDurationMin) || 15,
      description: form.description.trim()
    })

    if (res.success) {
      setForm({ name: '', prefix: '', avgDurationMin: 15, description: '' })
      setShowModal(false)
      await loadServices()
    } else {
      setErrorMsg(res.error || "Erreur lors de la création du service")
    }
    setSubmitting(false)
  }

  const handleToggle = async (serviceId: string) => {
    const res = await toggleServiceStatus(serviceId)
    if (res.success) {
      setServices(prev => prev.map(s => s.id === serviceId ? { ...s, isActive: res.isActive } : s))
    }
  }

  const handleDelete = async (serviceId: string, name: string) => {
    if (!confirm(`Désactiver ou supprimer le service "${name}" ?`)) return
    const res = await deleteOrganizationService(serviceId)
    if (res.success) {
      await loadServices()
    }
  }

  if (loading && services.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between shadow-sm">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Services de l&apos;Établissement</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Configurez les prestations, guichets et estimations d&apos;attente de votre entreprise
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setErrorMsg(null) }}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-200 transition-all"
        >
          <Plus size={18} />
          Nouveau Service
        </button>
      </div>

      {/* Modal Création de Service */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-gray-900 text-lg">Ajouter un service</h4>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nom du service *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Caisse & Facturation, Cardiologie, Retrait"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Lettre / Préfixe ticket
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="ex: C (donnera C001)"
                    value={form.prefix}
                    onChange={e => setForm(f => ({ ...f, prefix: e.target.value.toUpperCase() }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm uppercase font-mono font-bold focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Durée moy. (min) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    required
                    value={form.avgDurationMin}
                    onChange={e => setForm(f => ({ ...f, avgDurationMin: parseInt(e.target.value) || 15 }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Description (optionnel)
                </label>
                <textarea
                  rows={2}
                  placeholder="Précisions utiles pour les clients qui rejoignent la file..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || !form.name.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold disabled:opacity-50 transition-all shadow-md shadow-orange-200"
                >
                  {submitting ? 'Création...' : 'Créer le service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Services List */}
      {services.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <Settings size={44} className="mx-auto mb-3 text-gray-300" />
          <p className="font-bold text-gray-800 text-base">Aucun service configuré</p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Créez les services que votre établissement propose pour générer les files d&apos;attente correspondantes.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 inline-flex items-center gap-2 bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-xl"
          >
            <Plus size={14} /> Créer un premier service
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map(svc => (
            <div
              key={svc.id || svc.name}
              className={`bg-white rounded-2xl border transition-all p-5 shadow-sm ${
                svc.isActive === false ? 'opacity-60 border-gray-200 bg-gray-50/50' : 'border-gray-100 hover:border-orange-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 text-base">{svc.name}</h4>
                    {svc.isActive === false ? (
                      <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-md">Inactif</span>
                    ) : (
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-md">Actif</span>
                    )}
                  </div>
                  {svc.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                    <span>⏱️ Estimé : ~{svc.avgMin || 15} min / passage</span>
                    <span>•</span>
                    <span>{svc.completedToday || 0} servis aujourd&apos;hui</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {svc.id && (
                    <>
                      <button
                        onClick={() => handleToggle(svc.id)}
                        title={svc.isActive === false ? "Activer le service" : "Désactiver temporairement"}
                        className={`p-2 rounded-xl border transition-all ${
                          svc.isActive === false
                            ? 'border-green-200 text-green-600 hover:bg-green-50'
                            : 'border-amber-200 text-amber-600 hover:bg-amber-50'
                        }`}
                      >
                        <Power size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(svc.id, svc.name)}
                        title="Supprimer ou désactiver"
                        className="p-2 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Compteurs opérationnels */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                <div className="bg-orange-50/60 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-orange-600">{svc.count || 0}</p>
                  <p className="text-[11px] font-medium text-gray-600 mt-0.5">En attente</p>
                </div>
                <div className="bg-blue-50/60 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-blue-600">{svc.avgMin || 15} min</p>
                  <p className="text-[11px] font-medium text-gray-600 mt-0.5">Moy. traitement</p>
                </div>
                <div className="bg-green-50/60 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-green-600">{svc.completedToday || 0}</p>
                  <p className="text-[11px] font-medium text-gray-600 mt-0.5">Clôturés</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
