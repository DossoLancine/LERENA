'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'

export function PushNotification({ message, isVisible, onClose }: { message: string, isVisible: boolean, onClose: () => void }) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  return (
    <div className="fixed top-4 left-4 right-4 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-gray-900 text-white p-4 rounded-2xl shadow-xl flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
          <Bell size={16} className="text-white animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm">Notification ATTENDS</p>
          <p className="text-sm opacity-90 mt-0.5">{message}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          &times;
        </button>
      </div>
    </div>
  )
}
