'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { getTVQueue } from '../../actions/tv'
import {
  Volume2,
  Tv,
  Clock,
  Megaphone,
  Sparkles,
  Maximize2,
  Film,
  Layers,
  ChevronRight,
  Play,
  Pause,
  RotateCw,
  Radio,
  Wifi,
  Activity,
  ShieldCheck,
  ListVideo
} from 'lucide-react'

// Convertit les liens YouTube ou vidéo standard en format plein écran avec API JS activée
function getMediaEmbed(url: string | null | undefined): { type: 'youtube' | 'video' | 'none'; embedUrl: string } {
  if (!url || !url.trim()) return { type: 'none', embedUrl: '' }
  const clean = url.trim()

  const ytMatch = clean.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytMatch[1]}&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`
    }
  }

  return { type: 'video', embedUrl: clean }
}

// Générateur de carillon sonore futuriste Horizon 2050 (Web Audio API natif - aucun fichier externe requis)
function playFuturisticChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)

      gain.gain.setValueAtTime(0.01, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }

    // Accord harmonique d'appel futuriste (D5 -> A5 -> D6)
    playTone(587.33, 0, 0.45)
    playTone(880.0, 0.15, 0.55)
    playTone(1174.66, 0.35, 0.85)
  } catch (e) {}
}

export default function TVPage({ params }: { params: { orgId: string } }) {
  const [data, setData] = useState<any>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Mode de vue actif ('queue' ou 'media')
  const [activeView, setActiveView] = useState<'queue' | 'media'>('queue')
  const activeViewRef = useRef<'queue' | 'media'>('queue')
  activeViewRef.current = activeView

  // Timestamp de début de la vue courante (en millisecondes)
  const viewStartTimeRef = useRef<number>(Date.now())

  // Secondes restantes avant basculement
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30)

  // Index de la vidéo en cours dans la playlist multi-vidéos
  const [playlistIndex, setPlaylistIndex] = useState<number>(0)
  const playlistIndexRef = useRef<number>(0)
  playlistIndexRef.current = playlistIndex

  // Notification d'appel d'urgence/interruption
  const [urgentCall, setUrgentCall] = useState<any | null>(null)
  const urgentCallTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Index de la promotion active dans le carrousel TV
  const [promoIndex, setPromoIndex] = useState(0)

  // Suivi de la position de lecture vidéo (en secondes)
  const [videoPlayTime, setVideoPlayTime] = useState<number>(0)

  const prevActiveRef = useRef<string[]>([])
  const dataRef = useRef<any>(null)
  dataRef.current = data

  // Playlist résolue
  const playlist = useMemo(() => {
    if (data?.playlist && Array.isArray(data.playlist) && data.playlist.length > 0) {
      return data.playlist
    }
    if (data?.tvVideoUrl) {
      return [{ id: '1', title: 'Vidéo principale', url: data.tvVideoUrl }]
    }
    return []
  }, [data?.playlist, data?.tvVideoUrl])

  const currentVideo = playlist[playlistIndex] || playlist[0] || null

  const mediaInfo = useMemo(() => {
    return getMediaEmbed(currentVideo?.url)
  }, [currentVideo?.url])

  const mediaInfoRef = useRef(mediaInfo)
  mediaInfoRef.current = mediaInfo

  // Polling des données en temps réel
  const fetchData = useCallback(async () => {
    const res = await getTVQueue(params.orgId)
    if (res) {
      setData(res)

      // Détection de nouvel appel de ticket
      const currentActiveIds = res.active.map((t: any) => t.id)
      const newCalledTicket = res.active.find(
        (t: any) => t.status === 'CALLED' && !prevActiveRef.current.includes(t.id)
      )

      if (newCalledTicket) {
        // INTERRUPT IMMÉDIAT : Afficher l'appel en plein écran futuriste
        setUrgentCall(newCalledTicket)

        if (urgentCallTimeoutRef.current) clearTimeout(urgentCallTimeoutRef.current)
        urgentCallTimeoutRef.current = setTimeout(() => {
          setUrgentCall(null)
        }, 12000)

        // Carillon futuriste 2050 + Synthèse vocale
        playFuturisticChime()

        try {
          if ('speechSynthesis' in window) {
            const counterLabel = newCalledTicket.counter || (newCalledTicket.guestPhone?.startsWith('G-') ? newCalledTicket.guestPhone.replace('G-', '') : 'Guichet 1')
            const utterance = new SpeechSynthesisUtterance(
              `Ticket numéro ${newCalledTicket.displayNum}. Veuillez vous rendre au ${counterLabel}.`
            )
            utterance.lang = 'fr-FR'
            utterance.rate = 0.95
            window.speechSynthesis.speak(utterance)
          }
        } catch (e) {}
      }

      prevActiveRef.current = currentActiveIds
    }
  }, [params.orgId])

  useEffect(() => {
    fetchData()
    const pollInterval = setInterval(fetchData, 3000)
    return () => clearInterval(pollInterval)
  }, [fetchData])

  // Moteur d'horloge absolue et de rotation multi-vidéos
  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = Date.now()
      setCurrentTime(new Date(now))

      const currentData = dataRef.current
      if (!currentData) return

      const mode = currentData.tvMode || 'HYBRID'

      if (mode !== 'HYBRID') {
        if (activeViewRef.current !== 'queue') {
          activeViewRef.current = 'queue'
          setActiveView('queue')
        }
        return
      }

      const hasMedia =
        mediaInfoRef.current.type !== 'none' ||
        (currentData.promotions && currentData.promotions.length > 0)

      if (!hasMedia) {
        if (activeViewRef.current !== 'queue') {
          activeViewRef.current = 'queue'
          setActiveView('queue')
        }
        return
      }

      const queueDuration = Number(currentData.tvQueueDuration) || 30
      const videoDuration = Number(currentData.tvVideoDuration) || 30

      const targetDurationSec = activeViewRef.current === 'queue' ? queueDuration : videoDuration
      const elapsedSec = Math.floor((now - viewStartTimeRef.current) / 1000)
      const remainingSec = Math.max(0, targetDurationSec - elapsedSec)

      setSecondsRemaining(remainingSec)

      // BASCULEMENT DE PHASE
      if (elapsedSec >= targetDurationSec) {
        const nextView = activeViewRef.current === 'queue' ? 'media' : 'queue'
        activeViewRef.current = nextView
        setActiveView(nextView)
        viewStartTimeRef.current = now

        // Si on quitte la vidéo pour revenir à la file, préparer la vidéo suivante de la playlist !
        if (nextView === 'queue' && playlist.length > 1) {
          const nextIndex = (playlistIndexRef.current + 1) % playlist.length
          setPlaylistIndex(nextIndex)
          playlistIndexRef.current = nextIndex
        }

        const nextDuration = nextView === 'queue' ? queueDuration : videoDuration
        setSecondsRemaining(nextDuration)
      }
    }, 1000)

    return () => clearInterval(clockInterval)
  }, [playlist.length])

  // Rotation des promotions
  useEffect(() => {
    if (!data?.promotions || data.promotions.length <= 1) return
    const promoInterval = setInterval(() => {
      setPromoIndex(prev => (prev + 1) % data.promotions.length)
    }, 8000)
    return () => clearInterval(promoInterval)
  }, [data?.promotions])

  // Basculement manuel
  const toggleViewManually = () => {
    const nextView = activeView === 'queue' ? 'media' : 'queue'
    activeViewRef.current = nextView
    setActiveView(nextView)
    viewStartTimeRef.current = Date.now()

    if (nextView === 'queue' && playlist.length > 1) {
      const nextIndex = (playlistIndex + 1) % playlist.length
      setPlaylistIndex(nextIndex)
      playlistIndexRef.current = nextIndex
    }

    const nextDuration =
      nextView === 'queue' ? Number(data?.tvQueueDuration) || 30 : Number(data?.tvVideoDuration) || 30
    setSecondsRemaining(nextDuration)
  }

  // Passer à la vidéo suivante de la playlist
  const nextPlaylistItem = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (playlist.length <= 1) return
    const nextIndex = (playlistIndex + 1) % playlist.length
    setPlaylistIndex(nextIndex)
    playlistIndexRef.current = nextIndex
  }

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  if (!data) {
    return (
      <div className="h-screen w-screen bg-[#030712] flex flex-col items-center justify-center text-white relative overflow-hidden">
        <div className="absolute w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] animate-pulse" />
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4 relative z-10" />
        <p className="text-cyan-400 font-mono tracking-widest uppercase text-xs relative z-10">
          ATTENDS OS 2050 // INITIALIZING QUANTUM DISPLAY...
        </p>
      </div>
    )
  }

  const tvMode = data.tvMode || 'HYBRID'
  const activePromo = data.promotions?.[promoIndex]
  const currentTotalDuration =
    activeView === 'queue' ? Number(data.tvQueueDuration) || 30 : Number(data.tvVideoDuration) || 30
  const progressPercent = Math.min(
    100,
    Math.max(0, ((currentTotalDuration - secondsRemaining) / currentTotalDuration) * 100)
  )

  const isVideoPlaying = tvMode === 'SPLIT' ? !urgentCall : activeView === 'media' && !urgentCall

  const formatVideoTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  return (
    <div className="h-screen w-screen bg-[#04060c] text-white flex flex-col overflow-hidden relative select-none font-sans">
      {/* ========================================================= */}
      {/* LUMIÈRES D'AMBIANCE HORIZON 2050 (NEON MESH BACKGROUND) */}
      {/* ========================================================= */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[160px] pointer-events-none" />

      {/* ========================================================= */}
      {/* OVERLAY D'INTERRUPTION D'APPEL FUTURISTE 2050 */}
      {/* ========================================================= */}
      {urgentCall && (
        <div className="absolute inset-0 z-50 bg-[#03050a]/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-fadeIn">
          {/* Ondes radar d'appel */}
          <div className="absolute w-[500px] h-[500px] border border-orange-500/20 rounded-full animate-ping pointer-events-none" />
          <div className="absolute w-[700px] h-[700px] border border-cyan-500/10 rounded-full animate-pulse pointer-events-none" />

          <div className="max-w-4xl w-full bg-gradient-to-b from-gray-900/90 to-black border-2 border-orange-500/80 rounded-[32px] p-12 text-center shadow-[0_0_80px_rgba(249,115,22,0.3)] relative overflow-hidden">
            {/* Hologram Corner Brackets */}
            <span className="absolute top-4 left-4 text-orange-500 font-mono text-xl">┌</span>
            <span className="absolute top-4 right-4 text-orange-500 font-mono text-xl">┐</span>
            <span className="absolute bottom-4 left-4 text-orange-500 font-mono text-xl">└</span>
            <span className="absolute bottom-4 right-4 text-orange-500 font-mono text-xl">┘</span>

            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-black px-6 py-2 rounded-full text-sm font-black uppercase tracking-widest mb-6 shadow-lg shadow-orange-500/30">
              <Megaphone size={20} />
              <span>Priorité Appel En Cours // 2050</span>
            </div>

            <p className="text-gray-400 text-xl font-mono tracking-widest uppercase mb-2">IDENTIFIANT TICKET</p>
            <h2 className="text-[120px] leading-none font-black text-white tracking-tight mb-8 tabular-nums drop-shadow-[0_0_40px_rgba(255,255,255,0.4)]">
              {urgentCall.displayNum}
            </h2>

            <div className="border-t border-gray-800/80 pt-6">
              <p className="text-gray-400 text-base font-mono uppercase tracking-widest mb-1">Veuillez vous orienter vers le</p>
              <p className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-cyan-400">
                {urgentCall.counter || (urgentCall.guestPhone?.startsWith('G-') ? urgentCall.guestPhone.replace('G-', '') : 'GUICHET 1')}
              </p>
              <p className="text-cyan-400 text-base font-mono mt-2">
                Service : {urgentCall.service?.name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* BARRE DE PROGRESSION HOLOGRAPHIQUE CYBER */}
      {/* ========================================================= */}
      {tvMode === 'HYBRID' && (
        <div className="w-full h-1 bg-gray-900 relative z-30 shrink-0 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-orange-500 to-amber-400 transition-all duration-1000 ease-linear shadow-[0_0_12px_rgba(249,115,22,0.8)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* EN-TÊTE FUTURISTE SMART TV HUD */}
      {/* ========================================================= */}
      <header className="h-20 shrink-0 bg-[#060913]/90 backdrop-blur-md px-8 flex items-center justify-between border-b border-gray-800/80 z-20">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] text-white">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white">{data.orgName}</h1>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full uppercase tracking-widest">
                v2050
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
              <p className="text-xs text-gray-400 font-mono">INTELLIGENT RECEPTION PROTOCOL</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Badge Playlist & Rotation Multi-Vidéos Interactif */}
          {tvMode === 'HYBRID' && (
            <div className="flex items-center gap-1.5 bg-[#0a0f1d] border border-gray-800 px-3.5 py-1.5 rounded-full shadow-inner">
              <button
                onClick={toggleViewManually}
                className="flex items-center gap-2 text-xs font-semibold text-gray-200 hover:text-white transition-all"
                title="Basculer manuellement File / Vidéo"
              >
                <RotateCw size={13} className="text-cyan-400 animate-spin" style={{ animationDuration: '8s' }} />
                <span className="font-mono">
                  {activeView === 'queue' ? 'FILE' : 'VIDÉO'} [{secondsRemaining}s]
                </span>
              </button>

              {/* Indicateur de piste Playlist si plusieurs vidéos */}
              {playlist.length > 1 && (
                <div className="flex items-center gap-1 border-l border-gray-800 pl-2 ml-1">
                  <span className="text-[10px] font-mono text-orange-400 font-bold">
                    {playlistIndex + 1}/{playlist.length}
                  </span>
                  <button
                    onClick={nextPlaylistItem}
                    className="p-1 text-gray-400 hover:text-cyan-300 transition-all"
                    title="Passer à la vidéo suivante de la playlist"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Horloge & Date Cyber */}
          <div className="text-right">
            <p className="text-2xl font-black font-mono tabular-nums tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">
              {currentTime.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>

          <button
            onClick={toggleFullScreen}
            className="p-2.5 bg-gray-900/80 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white rounded-xl transition-all shadow-sm"
            title="Plein écran"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* CORPS PRINCIPAL : DIFFUSION HYBRIDE MULTI-VIDÉOS SANS COUPURE */}
      {/* ========================================================= */}
      <main className="flex-1 w-full h-[calc(100vh-112px)] relative overflow-hidden">
        {tvMode === 'SPLIT' ? (
          /* MODE SPLIT ÉCRAN SCINDÉ */
          <div className="w-full h-full p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-full flex flex-col overflow-hidden">
              <QueueDisplay data={data} />
            </div>
            <div className="h-full flex flex-col bg-black rounded-3xl border border-gray-800 overflow-hidden shadow-2xl relative">
              <PersistentMedia
                mediaInfo={mediaInfo}
                currentVideo={currentVideo}
                activePromo={activePromo}
                data={data}
                isPlaying={isVideoPlaying}
                onTimeUpdate={setVideoPlayTime}
              />
            </div>
          </div>
        ) : (
          /* MODE HYBRID PLEIN ÉCRAN CINÉMA HORIZON 2050 */
          <div className="w-full h-full relative">
            {/* COUCHE 1 : FILE D'ATTENTE */}
            <div
              className={`absolute inset-6 lg:inset-8 flex flex-col transition-all duration-700 ${
                activeView === 'queue'
                  ? 'opacity-100 z-10 scale-100 pointer-events-auto'
                  : 'opacity-0 z-0 scale-95 pointer-events-none'
              }`}
            >
              <QueueDisplay data={data} />
            </div>

            {/* COUCHE 2 : VIDÉOS & PUBLICITÉS (PERSISTANTE EN PLEIN ÉCRAN GÉANT) */}
            <div
              className={`absolute inset-4 lg:inset-6 flex flex-col bg-black rounded-[32px] border border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-700 ${
                activeView === 'media'
                  ? 'opacity-100 z-10 scale-100 pointer-events-auto'
                  : 'opacity-0 z-0 scale-95 pointer-events-none'
              }`}
            >
              {/* Badge HUD Horizon 2050 en incrustation */}
              <div className="absolute top-5 right-5 z-30 bg-[#050814]/85 backdrop-blur-md px-4 py-2 rounded-full text-xs text-gray-200 font-mono border border-cyan-500/30 flex items-center gap-3 shadow-2xl">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>
                  {currentVideo?.title ? currentVideo.title.toUpperCase() : 'CANAL PUBLICITAIRE'}
                </span>
                <span className="text-orange-400 font-bold border-l border-gray-700 pl-2">
                  FILE DANS {secondsRemaining}s
                </span>
              </div>

              {/* HUD Corner Brackets */}
              <span className="absolute top-3 left-3 text-cyan-500/40 font-mono text-lg pointer-events-none">┌</span>
              <span className="absolute top-3 right-3 text-cyan-500/40 font-mono text-lg pointer-events-none">┐</span>
              <span className="absolute bottom-3 left-3 text-cyan-500/40 font-mono text-lg pointer-events-none">└</span>
              <span className="absolute bottom-3 right-3 text-cyan-500/40 font-mono text-lg pointer-events-none">┘</span>

              <PersistentMedia
                mediaInfo={mediaInfo}
                currentVideo={currentVideo}
                activePromo={activePromo}
                data={data}
                isPlaying={isVideoPlaying}
                onTimeUpdate={setVideoPlayTime}
              />
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* BARRE DE TÉLÉMÉTRIE HORIZON 2050 EN BAS D'ÉCRAN */}
      {/* ========================================================= */}
      <footer className="h-7 shrink-0 bg-[#03050a] border-t border-gray-900 px-8 flex items-center justify-between text-[10px] font-mono text-gray-500 z-20">
        <div className="flex items-center gap-4">
          <span className="text-cyan-400 flex items-center gap-1">
            <Wifi size={11} /> QUANTUM LINK ACTIVE
          </span>
          <span>LATENCY: 8ms</span>
          <span>ROUTING ENGINE: ATTENDS v4.8</span>
        </div>
        <div className="flex items-center gap-4">
          {playlist.length > 0 && (
            <span className="text-gray-400 flex items-center gap-1">
              <ListVideo size={11} className="text-orange-400" />
              PLAYLIST: {playlistIndex + 1}/{playlist.length} ({currentVideo?.title || 'Clip'})
            </span>
          )}
          <span className="text-gray-600">HORIZON 2050 SMART SIGNAGE</span>
        </div>
      </footer>
    </div>
  )
}

// -------------------------------------------------------------
// COMPOSANT D'AFFICHAGE DE LA FILE D'ATTENTE (STYLE HUD 2050)
// -------------------------------------------------------------
function QueueDisplay({ data }: { data: any }) {
  return (
    <div className="flex-1 flex flex-col md:flex-row gap-8 w-full h-full">
      {/* Colonne Principale : Derniers Appels */}
      <div className="flex-[3] flex flex-col gap-6">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2.5">
            <Volume2 className="text-orange-500" size={24} />
            <span>Appels en cours</span>
          </h2>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1 rounded-full">
            {data.active.length} EN SERVICE
          </span>
        </div>

        {data.active.length === 0 ? (
          <div className="flex-1 bg-[#090d1a]/60 rounded-3xl border border-gray-800/80 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            <div className="w-20 h-20 rounded-full bg-cyan-500/5 flex items-center justify-center mb-3">
              <Radio size={32} className="text-cyan-500/40 animate-pulse" />
            </div>
            <p className="text-2xl text-gray-400 font-semibold mb-1">Aucun appel en cours</p>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-wider">
              Veuillez patienter en salle · Les tickets s'annoncent automatiquement
            </p>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 gap-5">
            {data.active.map((ticket: any) => (
              <div
                key={ticket.id}
                className={`bg-[#090d1a] rounded-3xl border-l-8 ${
                  ticket.status === 'CALLED'
                    ? 'border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.15)] animate-pulse'
                    : 'border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.15)]'
                } p-8 flex items-center justify-between border-y border-r border-gray-800/80 relative overflow-hidden`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">Ticket Client</p>
                    {ticket.priorityScore === 3 && (
                      <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-mono font-black px-2 py-0.5 rounded-md">
                        VIP PRIORITAIRE
                      </span>
                    )}
                    {ticket.priorityScore === 2 && (
                      <span className="bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-mono font-black px-2 py-0.5 rounded-md">
                        PMR
                      </span>
                    )}
                  </div>
                  <p className="text-8xl font-black font-mono tabular-nums tracking-tighter text-white">
                    {ticket.displayNum}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-1">Guichet assigné</p>
                  <p
                    className={`text-5xl font-black ${
                      ticket.status === 'CALLED' ? 'text-orange-400' : 'text-cyan-400'
                    }`}
                  >
                    {ticket.counter || (ticket.guestPhone?.startsWith('G-') ? ticket.guestPhone.replace('G-', '') : 'GUICHET 1')}
                  </p>
                  <p className="text-xs font-mono text-gray-400 mt-1">
                    {ticket.service?.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Colonne Droite : En attente */}
      <div className="flex-[1.5] flex flex-col bg-[#090d1a] rounded-3xl border border-gray-800/80 overflow-hidden shadow-xl">
        <div className="bg-gray-800/40 px-6 py-5 border-b border-gray-800/80 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2">
            <Clock size={16} className="text-orange-400" />
            <span>En attente</span>
          </h2>
          <span className="text-xs font-mono font-bold text-gray-300 bg-gray-800/80 px-2.5 py-0.5 rounded-full">
            {data.waiting.length}
          </span>
        </div>

        <div className="flex-1 p-5 flex flex-col gap-3 overflow-y-auto">
          {data.waiting.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 font-mono text-xs uppercase tracking-wider p-4 text-center">
              <p>File d'attente vide</p>
            </div>
          ) : (
            data.waiting.map((ticket: any, idx: number) => (
              <div
                key={ticket.id}
                className="bg-[#050814] rounded-2xl p-4 flex items-center justify-between border border-gray-800/60 hover:border-cyan-500/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-gray-800/80 text-gray-400 font-mono flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-2xl font-black font-mono text-gray-200 tabular-nums">
                    {ticket.displayNum}
                  </span>
                  {ticket.priorityScore === 3 && (
                    <span className="bg-red-500/20 text-red-400 text-[10px] font-mono font-black px-1.5 py-0.5 rounded">
                      VIP
                    </span>
                  )}
                  {ticket.priorityScore === 2 && (
                    <span className="bg-amber-500/20 text-amber-400 text-[10px] font-mono font-black px-1.5 py-0.5 rounded">
                      PMR
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-gray-400 truncate max-w-[140px] text-right">
                  {ticket.service?.name}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// LECTEUR MÉDIA PERSISTANT MULTI-VIDÉOS
// -------------------------------------------------------------
function PersistentMedia({
  mediaInfo,
  currentVideo,
  activePromo,
  data,
  isPlaying,
  onTimeUpdate
}: {
  mediaInfo: { type: 'youtube' | 'video' | 'none'; embedUrl: string }
  currentVideo?: { id: string; title: string; url: string } | null
  activePromo?: any
  data: any
  isPlaying: boolean
  onTimeUpdate: (seconds: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Contrôle lecture / pause de la vidéo standard
  useEffect(() => {
    const vid = videoRef.current
    if (!vid || mediaInfo.type !== 'video') return

    if (isPlaying) {
      vid.play().catch(e => console.log('Autoplay play error:', e))
    } else {
      vid.pause()
    }
  }, [isPlaying, mediaInfo.type, mediaInfo.embedUrl])

  // Contrôle lecture / pause du lecteur YouTube
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || mediaInfo.type !== 'youtube') return

    const sendCommand = (cmd: 'playVideo' | 'pauseVideo') => {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: cmd, args: [] }),
          '*'
        )
      } catch (e) {}
    }

    if (isPlaying) {
      sendCommand('playVideo')
    } else {
      sendCommand('pauseVideo')
    }
  }, [isPlaying, mediaInfo.type, mediaInfo.embedUrl])

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime)
    }
  }

  // Lecteur YouTube plein écran
  if (mediaInfo.type === 'youtube') {
    return (
      <div className="w-full h-full relative bg-black flex items-center justify-center overflow-hidden">
        <iframe
          key={mediaInfo.embedUrl}
          ref={iframeRef}
          src={mediaInfo.embedUrl}
          title={currentVideo?.title || "Vidéo d'information"}
          className="w-full h-full absolute inset-0 border-0 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
          allow="autoplay; encrypted-media; fullscreen"
        />
      </div>
    )
  }

  // Lecteur Vidéo HTML5 MP4 / WebM plein écran
  if (mediaInfo.type === 'video') {
    return (
      <div className="w-full h-full relative bg-black flex items-center justify-center overflow-hidden">
        <video
          key={mediaInfo.embedUrl}
          ref={videoRef}
          src={mediaInfo.embedUrl}
          muted
          playsInline
          loop
          onTimeUpdate={handleTimeUpdate}
          className="w-full h-full absolute inset-0 object-cover"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    )
  }

  // Carrousel publicitaire futuriste
  if (activePromo) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#090d1a] to-black p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold uppercase tracking-widest">
            <Sparkles size={16} />
            <span>OFFRE & ACTUALITÉ // {data.orgName}</span>
          </div>
          {activePromo.price && (
            <span className="bg-gradient-to-r from-orange-500 to-amber-400 text-black font-black text-sm px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.4)]">
              {activePromo.price}
            </span>
          )}
        </div>

        <div className="my-auto py-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {activePromo.imageUrl && (
            <div className="rounded-3xl overflow-hidden shadow-2xl border border-cyan-500/20 aspect-video max-h-[480px]">
              <img
                src={activePromo.imageUrl}
                alt={activePromo.title}
                className="w-full h-full object-cover"
                onError={e => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}
          <div className="space-y-4">
            <h3 className="text-5xl font-black text-white leading-tight">{activePromo.title}</h3>
            {activePromo.description && (
              <p className="text-gray-300 text-xl leading-relaxed">{activePromo.description}</p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-800/80 pt-4 flex items-center justify-between text-xs font-mono text-gray-500">
          <span>Renseignez-vous directement auprès de nos conseillers</span>
          <span>{data.promotions?.length} OFFRE(S) ACTIVE(S)</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-[#050814] flex flex-col items-center justify-center p-8 text-center text-gray-500">
      <Film size={56} className="text-gray-700 mb-3" />
      <p className="font-semibold text-gray-400 text-lg">Aucune vidéo dans la playlist</p>
      <p className="text-xs font-mono text-gray-600 mt-1 max-w-sm">
        Ajoutez vos vidéos dans les paramètres du manager pour activer la régie publicitaire continue.
      </p>
    </div>
  )
}
