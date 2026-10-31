'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { orgTopic, ORG_CHANGED_EVENT } from '@/lib/realtime'

let client: SupabaseClient | null = null

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return client
}

/**
 * Appelle onChange dès que le serveur signale un changement sur l'organisation
 * (ticket pris, appelé, terminé, service modifié…). Renvoie true tant que la
 * connexion temps réel est active, pour ralentir le rafraîchissement de secours.
 */
export function useOrgRealtime(orgId: string | null | undefined, onChange: () => void) {
  const [connected, setConnected] = useState(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const supabase = getClient()
    if (!orgId || !supabase) return

    // Regroupe les signaux rapprochés (ex. appel + début de service) en un seul rechargement
    let debounce: ReturnType<typeof setTimeout> | undefined
    const channel = supabase
      .channel(orgTopic(orgId))
      .on('broadcast', { event: ORG_CHANGED_EVENT }, () => {
        clearTimeout(debounce)
        debounce = setTimeout(() => onChangeRef.current(), 150)
      })
      .subscribe(status => setConnected(status === 'SUBSCRIBED'))

    return () => {
      clearTimeout(debounce)
      setConnected(false)
      supabase.removeChannel(channel)
    }
  }, [orgId])

  return connected
}
