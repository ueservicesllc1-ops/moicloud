'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Music, Settings } from 'lucide-react'

interface Track {
  id: string
  name: string
  color: string
  audioUrl?: string
  startTime?: number
  duration?: number
}

export default function DAWPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [tracks, setTracks] = useState<Track[]>([])
  const [selectedRange, setSelectedRange] = useState<{start: number, end: number} | null>(null)
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string>('')

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  // Tracks de ejemplo
  useEffect(() => {
    const exampleTracks: Track[] = [
      {
        id: 'track-1',
        name: 'Vocals',
        color: '#ff6b6b',
        startTime: 0,
        duration: 30
      },
      {
        id: 'track-2', 
        name: 'Bass',
        color: '#4ecdc4',
        startTime: 5,
        duration: 25
      },
      {
        id: 'track-3',
        name: 'Drums',
        color: '#45b7d1',
        startTime: 10,
        duration: 20
      },
      {
        id: 'track-4',
        name: 'Guitar',
        color: '#96ceb4',
        startTime: 15,
        duration: 15
      }
    ]
    setTracks(exampleTracks)
  }, [])

  const handleTrackUpdate = (trackId: string, startTime: number, duration: number) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId 
        ? { ...track, startTime, duration }
        : track
    ))
  }

  const handleSelectionChange = (start: number, end: number) => {
    setSelectedRange({ start, end })
    console.log('Selection changed:', { start, end })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Music className="w-6 h-6 text-blue-400" />
              <h1 className="text-xl font-semibold">DAW Timeline</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* DAW Timeline */}
      <div className="h-[calc(100vh-80px)] flex items-center justify-center">
        <div className="text-center">
          <Music className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl text-gray-400 mb-2">DAW Timeline</h2>
          <p className="text-gray-500">Componente temporalmente no disponible</p>
        </div>
      </div>

      {/* Info Panel */}
      {selectedRange && (
        <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-600 rounded-lg p-4 max-w-sm">
          <h3 className="font-semibold mb-2">Selection Info</h3>
          <div className="text-sm text-gray-300 space-y-1">
            <div>Start: {selectedRange.start.toFixed(2)}s</div>
            <div>End: {selectedRange.end.toFixed(2)}s</div>
            <div>Duration: {(selectedRange.end - selectedRange.start).toFixed(2)}s</div>
          </div>
        </div>
      )}
    </div>
  )
}
