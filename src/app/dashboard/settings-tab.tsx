'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Building2,
  Tv,
  QrCode,
  Users,
  Database,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Printer,
  Download,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  Phone,
  Mail,
  MapPin,
  Clock,
  UserPlus,
  PlaySquare,
  Layers,
  SplitSquareHorizontal,
  Film,
  Sparkles,
  Info,
  Plus
} from 'lucide-react'
import QRCode from 'qrcode'
import {
  getOrganizationSettings,
  updateOrganizationProfile,
  addMemberToOrganization,
  removeMemberFromOrganization,
  resetDailyQueue,
  exportTicketsHistory
} from '../actions/settings'

export default function SettingsTab() {
  const [activeSubSection, setActiveSubSection] = useState<'profile' | 'qrcode' | 'tv' | 'team' | 'data'>('profile')
  const [org, setOrg] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Formulaire Profil
  const [formData, setFormData] = useState({
    name: '',
    category: 'Santé',
    description: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    isActive: true,
    tvVideoUrl: '',
    tvMode: 'HYBRID',
    tvQueueDuration: 30,
    tvVideoDuration: 30
  })

  // QR Code State
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedTvUrl, setCopiedTvUrl] = useState(false)

  // Playlist Multi-Vidéos
  const [playlist, setPlaylist] = useState<Array<{ id: string; title: string; url: string }>>([])

  // Formulaire Nouvel Agent
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    phone: '',
    password: 'password123',
    role: 'AGENT' as 'AGENT' | 'MANAGER'
  })
  const [addingMember, setAddingMember] = useState(false)

  // Opérations de données
  const [resettingQueue, setResettingQueue] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    const res = await getOrganizationSettings()
    if (res.success && res.data) {
      setOrg(res.data)
      setFormData({
        name: res.data.name || '',
        category: res.data.category || 'Santé',
        description: res.data.description || '',
        address: res.data.address || '',
        city: res.data.city || '',
        phone: res.data.phone || '',
        email: res.data.email || '',
        isActive: res.data.isActive ?? true,
        tvVideoUrl: res.data.tvVideoUrl || '',
        tvMode: res.data.tvMode || 'HYBRID',
        tvQueueDuration: res.data.tvQueueDuration || 30,
        tvVideoDuration: res.data.tvVideoDuration || 30
      })

      // Charger la playlist multi-vidéos
      let parsedPlaylist: Array<{ id: string; title: string; url: string }> = []
      if (res.data.tvVideoUrl && res.data.tvVideoUrl.trim()) {
        try {
          if (res.data.tvVideoUrl.trim().startsWith('[')) {
            parsedPlaylist = JSON.parse(res.data.tvVideoUrl)
          } else {
            parsedPlaylist = [{ id: '1', title: 'Vidéo principale', url: res.data.tvVideoUrl.trim() }]
          }
        } catch (e) {
          parsedPlaylist = [{ id: '1', title: 'Vidéo principale', url: res.data.tvVideoUrl.trim() }]
        }
      }
      setPlaylist(parsedPlaylist)

      // Générer le QR Code pour l'organisation
      if (typeof window !== 'undefined') {
        const clientUrl = `${window.location.origin}/org/${res.data.id}`
        QRCode.toDataURL(clientUrl, {
          width: 400,
          margin: 2,
          color: {
            dark: '#111827',
            light: '#FFFFFF'
          }
        }).then(url => setQrCodeDataUrl(url))
      }
    } else {
      setErrorMsg(res.error || 'Erreur lors du chargement des paramètres')
    }
    setLoading(false)
  }

  const showToast = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 4000)
  }

  const addPlaylistItem = () => {
    setPlaylist(prev => [
      ...prev,
      { id: Date.now().toString(), title: `Vidéo ${prev.length + 1}`, url: '' }
    ])
  }

  const updatePlaylistItem = (id: string, field: 'title' | 'url', value: string) => {
    setPlaylist(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  const removePlaylistItem = (id: string) => {
    setPlaylist(prev => prev.filter(item => item.id !== id))
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org) return
    setSaving(true)
    setErrorMsg(null)

    const validPlaylist = playlist.filter(p => p.url && p.url.trim().length > 0)
    const payload = {
      ...formData,
      tvVideoUrl: validPlaylist.length > 0 ? JSON.stringify(validPlaylist) : ''
    }

    const res = await updateOrganizationProfile(org.id, payload)
    if (res.success) {
      showToast('Paramètres enregistrés avec succès !')
    } else {
      setErrorMsg(res.error || 'Erreur lors de l’enregistrement')
    }
    setSaving(false)
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org || !newMember.name || !newMember.email) return
    setAddingMember(true)

    const res = await addMemberToOrganization(org.id, newMember)
    if (res.success) {
      showToast(`Collaborateur ${newMember.name} ajouté avec succès !`)
      setNewMember({ name: '', email: '', phone: '', password: 'password123', role: 'AGENT' })
      setShowAddMemberModal(false)
      loadSettings()
    } else {
      setErrorMsg(res.error || 'Erreur lors de l’ajout du collaborateur')
    }
    setAddingMember(false)
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Confirmez-vous le retrait de ${memberName} de l'équipe ?`)) return
    const res = await removeMemberFromOrganization(memberId)
    if (res.success) {
      showToast(`${memberName} a été retiré de l'équipe.`)
      loadSettings()
    } else {
      setErrorMsg(res.error || 'Impossible de retirer ce membre')
    }
  }

  const handleResetQueue = async () => {
    if (!org) return
    const confirmPrompt = confirm(
      'Attention : Vous allez clôturer tous les tickets en cours et remettre la file d’attente à zéro pour la journée. Confirmer ?'
    )
    if (!confirmPrompt) return

    setResettingQueue(true)
    const res = await resetDailyQueue(org.id)
    if (res.success) {
      showToast(`File d’attente réinitialisée (${res.count} tickets clôturés)`)
    } else {
      setErrorMsg(res.error || 'Erreur lors de la réinitialisation')
    }
    setResettingQueue(false)
  }

  const handleExportCSV = async () => {
    if (!org) return
    setExportingCsv(true)
    const res = await exportTicketsHistory(org.id)
    if (res.success && res.tickets) {
      const headers = ['ID', 'Numéro', 'Service', 'Client', 'Téléphone', 'Statut', 'Priorité', 'Avis_NPS', 'Date']
      const rows = res.tickets.map((t: any) => [
        t.id,
        t.number,
        `"${t.service}"`,
        `"${t.client}"`,
        `"${t.phone}"`,
        t.status,
        t.priority,
        t.nps,
        `"${new Date(t.date).toLocaleString('fr-FR')}"`
      ])

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `attends_tickets_${org.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast('Export CSV téléchargé avec succès !')
    } else {
      setErrorMsg(res.error || 'Erreur lors de l’export des données')
    }
    setExportingCsv(false)
  }

  const handlePrintPoster = () => {
    window.print()
  }

  const copyToClipboard = (text: string, isTv = false) => {
    navigator.clipboard.writeText(text)
    if (isTv) {
      setCopiedTvUrl(true)
      setTimeout(() => setCopiedTvUrl(false), 2000)
    } else {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-500">Chargement des paramètres...</p>
        </div>
      </div>
    )
  }

  const clientPageUrl = typeof window !== 'undefined' && org ? `${window.location.origin}/org/${org.id}` : ''
  const tvPageUrl = typeof window !== 'undefined' && org ? `${window.location.origin}/tv/${org.id}` : ''

  return (
    <div className="space-y-6">
      {/* Toast de succès */}
      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 text-green-800 text-sm font-medium animate-fadeIn shadow-sm">
          <CheckCircle2 size={18} className="text-green-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Message d'erreur */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-sm font-medium animate-fadeIn shadow-sm">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Navigation sous-onglets Paramètres */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-100">
        <button
          onClick={() => setActiveSubSection('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeSubSection === 'profile'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
              : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
          }`}
        >
          <Building2 size={15} />
          Profil Établissement
        </button>

        <button
          onClick={() => setActiveSubSection('qrcode')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeSubSection === 'qrcode'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
              : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
          }`}
        >
          <QrCode size={15} />
          Affiche & QR Code
        </button>

        <button
          onClick={() => setActiveSubSection('tv')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeSubSection === 'tv'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
              : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
          }`}
        >
          <Tv size={15} />
          Écran TV & Publicités
        </button>

        <button
          onClick={() => setActiveSubSection('team')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeSubSection === 'team'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
              : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
          }`}
        >
          <Users size={15} />
          Équipe & Agents ({org?.members?.length || 0})
        </button>

        <button
          onClick={() => setActiveSubSection('data')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeSubSection === 'data'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
              : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
          }`}
        >
          <Database size={15} />
          Opérations & Données
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1. SECTION PROFIL & COORDONNÉES */}
      {/* ========================================================= */}
      {activeSubSection === 'profile' && (
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
                value={formData.category}
                onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
              >
                <option value="Santé">Santé (Hôpital / Clinique / Cabinet)</option>
                <option value="Pharmacie">Pharmacie</option>
                <option value="Banque">Banque & Microfinance</option>
                <option value="Télécom">Téléphonie & SAV</option>
                <option value="Administration">Administration Publique</option>
                <option value="Commerce">Commerce & Magasin</option>
                <option value="Autre">Autre service</option>
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
                placeholder="Ex: Abidjan"
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
              className="flex items-center gap-2 bg-orange-500 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-orange-600 active:scale-95 transition-all text-sm shadow-md shadow-orange-200 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* 2. SECTION AFFICHE & QR CODE D'ACCUEIL */}
      {/* ========================================================= */}
      {activeSubSection === 'qrcode' && (
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
                <p className="text-[10px] text-gray-400 mt-4 tracking-widest uppercase">Propulsé par ATTENDS</p>
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
                    className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold text-xs hover:bg-orange-600 active:scale-95 transition-all shadow-md shadow-orange-200"
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
      )}

      {/* ========================================================= */}
      {/* 3. SECTION ÉCRAN SALLE D'ATTENTE & PUBLICITÉS VIDÉO */}
      {/* ========================================================= */}
      {activeSubSection === 'tv' && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl border border-gray-100 p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">Écran Connecté & Régie Publicitaire (Smart TV)</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Diffusez les appels de tickets et alternez avec vos vidéos d'entreprise ou offres promotionnelles.
              </p>
            </div>
            <a
              href={tvPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
            >
              <ExternalLink size={15} />
              Lancer l'Écran TV Plein Écran
            </a>
          </div>

          {/* Choix du mode d'affichage TV */}
          <div>
            <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
              Mode de diffusion de la salle d'attente
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  formData.tvMode === 'HYBRID'
                    ? 'border-orange-500 bg-orange-50/40 text-orange-950'
                    : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers size={18} className="text-orange-500" />
                    <span className="font-bold text-sm">Alternance Dynamique</span>
                  </div>
                  <input
                    type="radio"
                    name="tvMode"
                    value="HYBRID"
                    checked={formData.tvMode === 'HYBRID'}
                    onChange={e => setFormData(f => ({ ...f, tvMode: e.target.value }))}
                    className="w-4 h-4 text-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Alterne automatiquement entre la file d'attente et votre vidéo/publicité selon les durées configurées.
                </p>
              </label>

              <label
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  formData.tvMode === 'SPLIT'
                    ? 'border-orange-500 bg-orange-50/40 text-orange-950'
                    : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <SplitSquareHorizontal size={18} className="text-orange-500" />
                    <span className="font-bold text-sm">Écran Scindé</span>
                  </div>
                  <input
                    type="radio"
                    name="tvMode"
                    value="SPLIT"
                    checked={formData.tvMode === 'SPLIT'}
                    onChange={e => setFormData(f => ({ ...f, tvMode: e.target.value }))}
                    className="w-4 h-4 text-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Affiche en simultané : 50% file d'attente à gauche et 50% vidéo publicitaire en boucle à droite.
                </p>
              </label>

              <label
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  formData.tvMode === 'QUEUE_ONLY'
                    ? 'border-orange-500 bg-orange-50/40 text-orange-950'
                    : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Tv size={18} className="text-orange-500" />
                    <span className="font-bold text-sm">File Seule</span>
                  </div>
                  <input
                    type="radio"
                    name="tvMode"
                    value="QUEUE_ONLY"
                    checked={formData.tvMode === 'QUEUE_ONLY'}
                    onChange={e => setFormData(f => ({ ...f, tvMode: e.target.value }))}
                    className="w-4 h-4 text-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Affiche uniquement les tickets en continu sans interruption vidéo.
                </p>
              </label>
            </div>
          </div>

          {/* Configuration de la Playlist Vidéos & Timing */}
          <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film size={18} className="text-orange-500" />
                <div>
                  <h3 className="font-bold text-sm text-gray-900">Playlist Vidéos & Publicités ({playlist.length})</h3>
                  <p className="text-[11px] text-gray-500">
                    Ajoutez plusieurs vidéos. L'écran Smart TV les enchaînera automatiquement dans l'ordre.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={addPlaylistItem}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <Plus size={14} />
                Ajouter une vidéo
              </button>
            </div>

            {/* Liste des vidéos de la playlist */}
            {playlist.length === 0 ? (
              <div className="p-6 bg-white border border-dashed border-gray-200 rounded-2xl text-center">
                <Film size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-gray-600">Aucune vidéo dans la playlist</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Cliquez sur « Ajouter une vidéo » pour insérer un lien YouTube ou un fichier MP4.
                </p>
                <button
                  type="button"
                  onClick={addPlaylistItem}
                  className="mt-3 inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                >
                  <Plus size={13} />
                  Ajouter ma première vidéo
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {playlist.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-3 hover:border-orange-200 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 text-xs font-mono font-bold flex items-center justify-center">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <input
                          type="text"
                          value={item.title}
                          onChange={e => updatePlaylistItem(item.id, 'title', e.target.value)}
                          placeholder="Titre de la vidéo (ex: Présentation Clinique)"
                          className="text-xs font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-orange-500 focus:outline-none px-1 py-0.5"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePlaylistItem(item.id)}
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                        title="Supprimer cette vidéo"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={item.url}
                        onChange={e => updatePlaylistItem(item.id, 'url', e.target.value)}
                        placeholder="Lien YouTube ou direct MP4 (ex: https://www.youtube.com/watch?v=...)"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-gray-500">
              Astuce : Si aucune vidéo n'est configurée, la Smart TV diffusera automatiquement vos promotions marketing sous forme de diaporama interactif.
            </p>

            {formData.tvMode === 'HYBRID' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Durée d'affichage de la File d'attente
                  </label>
                  <select
                    value={formData.tvQueueDuration}
                    onChange={e => setFormData(f => ({ ...f, tvQueueDuration: parseInt(e.target.value) }))}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value={15}>15 secondes</option>
                    <option value={30}>30 secondes (Recommandé)</option>
                    <option value={45}>45 secondes</option>
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Durée d'affichage de la Vidéo / Publicité
                  </label>
                  <select
                    value={formData.tvVideoDuration}
                    onChange={e => setFormData(f => ({ ...f, tvVideoDuration: parseInt(e.target.value) }))}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value={15}>15 secondes</option>
                    <option value={30}>30 secondes (Recommandé)</option>
                    <option value={45}>45 secondes</option>
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                  </select>
                </div>
              </div>
            )}

            {/* Note de priorité aux appels */}
            <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 text-xs">
              <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <p>
                <strong>Priorité absolue aux appels :</strong> Même si une vidéo ou une publicité tourne, dès qu'un
                guichetier clique sur « Appeler le suivant », l'écran interrompt instantanément la diffusion pour afficher
                le numéro en très grand avec le signal sonore ding-dong et la synthèse vocale !
              </p>
            </div>
          </div>

          {/* Lien TV dédié & Copie */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/70 space-y-2">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Lien direct à ouvrir sur la télévision :</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={tvPageUrl}
                className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-600 truncate"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(tvPageUrl, true)}
                className="flex items-center gap-1 bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                <Copy size={13} />
                {copiedTvUrl ? 'Copié !' : 'Copier'}
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-orange-500 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-orange-600 active:scale-95 transition-all text-sm shadow-md shadow-orange-200 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Enregistrement...' : 'Enregistrer la configuration TV'}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* 4. SECTION ÉQUIPE & AGENTS */}
      {/* ========================================================= */}
      {activeSubSection === 'team' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">Équipe & Guichetiers</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Gérez les collaborateurs habilités à appeler et traiter les tickets depuis l'espace Agent (`/agent`).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddMemberModal(true)}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-orange-600 transition-all shadow-md shadow-orange-200"
            >
              <UserPlus size={15} />
              Ajouter un Collaborateur
            </button>
          </div>

          {/* Liste des membres */}
          <div className="divide-y divide-gray-100">
            {org?.members?.map((member: any) => (
              <div key={member.id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold ${
                    member.role === 'MANAGER' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {member.user?.name?.slice(0, 2).toUpperCase() || 'AG'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 text-sm">{member.user?.name || 'Collaborateur'}</p>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                        member.role === 'MANAGER'
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {member.role === 'MANAGER' ? 'DIRECTEUR' : 'GUICHETIER / AGENT'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {member.user?.email} {member.user?.phone ? `· ${member.user.phone}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {member.role !== 'MANAGER' && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id, member.user?.name)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Retirer de l'équipe"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Modale d'ajout d'agent */}
          {showAddMemberModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="font-bold text-gray-900 text-sm">Nouveau collaborateur</h3>
                  <button
                    onClick={() => setShowAddMemberModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleAddMember} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nom complet *</label>
                    <input
                      type="text"
                      required
                      value={newMember.name}
                      onChange={e => setNewMember(m => ({ ...m, name: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Ex: Awa Traoré"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email professionnel *</label>
                    <input
                      type="email"
                      required
                      value={newMember.email}
                      onChange={e => setNewMember(m => ({ ...m, email: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Ex: awa@attends.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Téléphone</label>
                    <input
                      type="tel"
                      value={newMember.phone}
                      onChange={e => setNewMember(m => ({ ...m, phone: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Ex: +225 05 00 00 00 00"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mot de passe provisoire</label>
                    <input
                      type="text"
                      value={newMember.password}
                      onChange={e => setNewMember(m => ({ ...m, password: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Rôle assigné</label>
                    <select
                      value={newMember.role}
                      onChange={e => setNewMember(m => ({ ...m, role: e.target.value as any }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="AGENT">Guichetier / Agent (Accès /agent)</option>
                      <option value="MANAGER">Manager / Administrateur (Accès complet /dashboard)</option>
                    </select>
                  </div>

                  <div className="pt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddMemberModal(false)}
                      className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={addingMember}
                      className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-50"
                    >
                      {addingMember ? 'Création...' : 'Créer le compte'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. SECTION OPÉRATIONS & DONNÉES */}
      {/* ========================================================= */}
      {activeSubSection === 'data' && (
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
      )}
    </div>
  )
}
