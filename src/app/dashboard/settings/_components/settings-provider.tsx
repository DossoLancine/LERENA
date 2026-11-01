'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import {
  getOrganizationSettings,
  updateOrganizationProfile,
  addMemberToOrganization,
  removeMemberFromOrganization,
  resetDailyQueue,
  exportTicketsHistory
} from '@/server/actions/settings'
import { useToast } from '@/components/ui/toast'
import { getSectors } from '@/server/actions/platform'

// État et actions partagés par toutes les pages Paramètres (établissement, affiche, TV, équipe, données)
function useSettingsState() {
  const toast = useToast()
  const [org, setOrg] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Formulaire Profil
  const [formData, setFormData] = useState({
    name: '',
    sectorId: '',
    description: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    isActive: true,
    bookingMode: 'QUEUE_ONLY',
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
    password: '',
    role: 'AGENT' as 'RECEPTION' | 'AGENT' | 'MANAGER'
  })
  const [addingMember, setAddingMember] = useState(false)
  // Identifiants du dernier compte créé, à transmettre au collaborateur (affichés une seule fois)
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; password: string } | null>(null)
  const [sectors, setSectors] = useState<Array<{ id: string; name: string; description: string | null }>>([])

  // Opérations de données
  const [resettingQueue, setResettingQueue] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSettings()
    getSectors().then(setSectors)
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    const res = await getOrganizationSettings()
    if (res.success && res.data) {
      setOrg(res.data)
      setFormData({
        name: res.data.name || '',
        sectorId: res.data.sectorId || '',
        description: res.data.description || '',
        address: res.data.address || '',
        city: res.data.city || '',
        phone: res.data.phone || '',
        email: res.data.email || '',
        isActive: res.data.isActive ?? true,
        bookingMode: res.data.bookingMode || 'QUEUE_ONLY',
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

  const showToast = (msg: string) => toast(msg)

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
      if (res.tempPassword) setCreatedCredentials({ name: newMember.name, email: newMember.email.trim().toLowerCase(), password: res.tempPassword })
      setNewMember({ name: '', email: '', phone: '', password: '', role: 'AGENT' })
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

  const clientPageUrl = typeof window !== 'undefined' && org ? `${window.location.origin}/org/${org.id}` : ''
  const tvPageUrl = typeof window !== 'undefined' && org ? `${window.location.origin}/tv/${org.id}` : ''

  return { org, setOrg, loading, setLoading, saving, setSaving, successMsg, setSuccessMsg, errorMsg, setErrorMsg, formData, setFormData, qrCodeDataUrl, setQrCodeDataUrl, copiedUrl, setCopiedUrl, copiedTvUrl, setCopiedTvUrl, playlist, setPlaylist, showAddMemberModal, setShowAddMemberModal, newMember, setNewMember, createdCredentials, setCreatedCredentials, sectors, addingMember, setAddingMember, resettingQueue, setResettingQueue, exportingCsv, setExportingCsv, printRef, loadSettings, showToast, addPlaylistItem, updatePlaylistItem, removePlaylistItem, handleSaveProfile, handleAddMember, handleRemoveMember, handleResetQueue, handleExportCSV, handlePrintPoster, copyToClipboard, clientPageUrl, tvPageUrl }
}

export type SettingsState = ReturnType<typeof useSettingsState>

const SettingsContext = createContext<SettingsState | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const value = useSettingsState()
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings doit être utilisé dans SettingsProvider')
  return ctx
}
