export interface WaitEstimate {
  lowMin: number
  highMin: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  label: string
}

/**
 * Moteur d'estimation du temps d'attente ATTENDS.
 * Utilise une pondération médiane/moyenne sur les sessions récentes.
 */
export function estimateWait(
  position: number,
  recentDurationsSeconds: number[],
  activeAgents: number,
  serviceAvgDurationMin?: number
): WaitEstimate {
  if (position <= 0) {
    return { lowMin: 0, highMin: 0, confidence: 'HIGH', label: "C'est votre tour !" }
  }

  const agents = Math.max(1, activeAgents)
  let avgSec: number
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW'

  if (recentDurationsSeconds.length >= 5) {
    const sorted = [...recentDurationsSeconds].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const mean = recentDurationsSeconds.reduce((s, v) => s + v, 0) / recentDurationsSeconds.length
    // Pondération : 60% médiane + 40% moyenne (résistant aux valeurs aberrantes)
    avgSec = median * 0.6 + mean * 0.4
    confidence = recentDurationsSeconds.length >= 20 ? 'HIGH' : 'MEDIUM'
  } else if (serviceAvgDurationMin) {
    avgSec = serviceAvgDurationMin * 60
    confidence = 'LOW'
  } else {
    avgSec = 15 * 60 // défaut 15 min par personne
    confidence = 'LOW'
  }

  // Temps total = (position × durée_moyenne) / agents_actifs
  const totalSec = (position * avgSec) / agents

  // Variance : ±20% du total ou minimum ±5 min
  const variance = Math.max(totalSec * 0.2, 5 * 60)

  const lowMin = Math.max(1, Math.round((totalSec - variance) / 60))
  const highMin = Math.round((totalSec + variance) / 60)

  return { lowMin, highMin, confidence, label: `${lowMin}–${highMin} min` }
}

export function formatWaitLabel(estimate: WaitEstimate): string {
  if (estimate.lowMin === 0) return "C'est votre tour !"
  if (estimate.lowMin === estimate.highMin) return `~${estimate.lowMin} min`
  return `${estimate.lowMin}–${estimate.highMin} min`
}

export function getConfidenceLabel(confidence: WaitEstimate['confidence']): string {
  switch (confidence) {
    case 'HIGH': return 'Estimation précise'
    case 'MEDIUM': return 'Estimation en cours d\'apprentissage'
    case 'LOW': return 'Estimation approximative'
  }
}
