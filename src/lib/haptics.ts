'use client'

// Retours physiques et sonores, comme dans une application native.
// Tout est silencieusement ignoré quand l'appareil ne le permet pas (iPhone sans vibration web, etc.).

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  } catch {}
}

export const haptics = {
  // Appui sur un bouton
  tap: () => vibrate(10),
  // Action réussie (ticket pris, client servi)
  success: () => vibrate([15, 60, 25]),
  // Votre tour approche
  nudge: () => vibrate([40, 80, 40]),
  // C'est votre tour : impossible à manquer
  alert: () => vibrate([300, 120, 300, 120, 600]),
}

let audioCtx: AudioContext | null = null

// Carillon à trois notes joué quand le ticket est appelé (sans fichier audio à télécharger)
export function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audioCtx = audioCtx ?? new Ctx()
    const ctx = audioCtx
    const notes = [880, 1108.73, 1318.51]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = ctx.currentTime + i * 0.18
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.65)
    })
  } catch {}
}

// Les navigateurs n'autorisent le son qu'après un geste de l'utilisateur :
// on « réveille » l'audio au premier appui pour que le carillon puisse sonner plus tard.
export function unlockAudio() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audioCtx = audioCtx ?? new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch {}
}
