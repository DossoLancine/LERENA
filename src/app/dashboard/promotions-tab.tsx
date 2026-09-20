'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Tag, ImageIcon } from 'lucide-react'
import { getManagerPromotions, createPromotion, deletePromotion } from '../actions/marketing'

export default function PromotionsTab() {
  const [promos, setPromos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', imageUrl: '', price: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getManagerPromotions().then(data => {
      setPromos(data)
      setLoading(false)
    })
  }, [])

  const handleCreate = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    await createPromotion(form)
    const data = await getManagerPromotions()
    setPromos(data)
    setForm({ title: '', description: '', imageUrl: '', price: '' })
    setShowForm(false)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await deletePromotion(id)
    setPromos(p => p.filter(x => x.id !== id))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Vitrine de Promotions</h3>
          <p className="text-xs text-gray-500 mt-0.5">Affiché sur le ticket digital de vos clients</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-all"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-orange-200 p-5 space-y-3">
          <h4 className="font-semibold text-gray-900">Nouvelle promotion</h4>
          <input
            type="text"
            placeholder="Titre de l'offre *"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <textarea
            placeholder="Description (optionnel)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
          <input
            type="text"
            placeholder="URL de l'image (optionnel)"
            value={form.imageUrl}
            onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <input
            type="text"
            placeholder="Prix ou label (ex: -20%, Gratuit, 5 000 FCFA)"
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={!form.title.trim() || saving}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Publier'}
            </button>
          </div>
        </div>
      )}

      {/* Promotions list */}
      {promos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Tag size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">Aucune promotion active</p>
          <p className="text-xs text-gray-400 mt-1">Ajoutez des offres pour les afficher sur les tickets clients.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map(promo => (
            <div key={promo.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3">
              {promo.imageUrl ? (
                <img src={promo.imageUrl} alt={promo.title} className="w-16 h-16 rounded-xl object-cover shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                  <ImageIcon size={24} className="text-orange-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-gray-900 text-sm truncate">{promo.title}</p>
                  {promo.price && (
                    <span className="shrink-0 bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">{promo.price}</span>
                  )}
                </div>
                {promo.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{promo.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">
                    🎁 {promo.claimsCount || 0} réclamé{(promo.claimsCount || 0) > 1 ? 's' : ''} au guichet
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Visible sur le ticket client
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(promo.id)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-red-100 text-red-400 hover:bg-red-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
