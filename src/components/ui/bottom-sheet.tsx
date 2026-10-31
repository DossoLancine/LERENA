'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Volet qui monte depuis le bas de l'écran, comme dans les applications natives.
 * Se ferme en le faisant glisser vers le bas, en touchant le fond ou avec Échap.
 */
export function BottomSheet({ open, onClose, children, dismissible = true }: {
  open: boolean
  onClose: () => void
  children: ReactNode
  dismissible?: boolean
}) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)

  // Monte le volet, puis déclenche l'animation à l'image suivante
  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = setTimeout(() => setMounted(false), 260)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open || !dismissible) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismissible, onClose])

  if (!mounted) return null

  const onPointerDown = (e: React.PointerEvent) => {
    if (!dismissible) return
    startY.current = e.clientY
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current === null) return
    setDragY(Math.max(0, e.clientY - startY.current))
  }
  const onPointerUp = () => {
    if (startY.current === null) return
    startY.current = null
    if (dragY > 90) onClose()
    setDragY(0)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => dismissible && onClose()}
      />
      <div
        className="relative w-full max-w-lg rounded-t-3xl bg-white pb-safe shadow-2xl"
        style={{
          transform: `translateY(${visible ? dragY : 100}${visible ? 'px' : '%'})`,
          transition: startY.current === null ? 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none'
        }}
      >
        <div
          className="flex cursor-grab touch-none justify-center pt-3 pb-2"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="h-1.5 w-10 rounded-full bg-gray-300" />
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}
