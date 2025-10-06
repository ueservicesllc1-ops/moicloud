'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX, 
  Settings, 
  Download,
  ArrowLeft,
  RotateCcw,
  Zap,
  Music,
  Mic,
  Guitar,
  Drum,
  Piano
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getUserSongs, Song } from '@/lib/firestore'

interface TrackData {
  name: string
  url: string
  volume: number
  muted: boolean
  solo: boolean
  pan: number
  eq: {
    low: number
    mid: number
    high: number
  }
  effects: {
    reverb: number
    delay: number
    distortion: number
  }
}

interface MixerState {
  isPlaying: boolean
  masterVolume: number
  masterMuted: boolean
  tracks: TrackData[]
}

const MixerPage: React.FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  
  const [mixerState, setMixerState] = useState<MixerState>({
    isPlaying: false,
    masterVolume: 0.8,
    masterMuted: false,
    tracks: []
  })
  
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [gainNodes, setGainNodes] = useState<{ [key: string]: GainNode }>({})
  const [audioElements, setAudioElements] = useState<{ [key: string]: HTMLAudioElement }>({})
  
  const masterGainRef = useRef<GainNode | null>(null)

  // Obtener ID de canción desde URL
  const songId = searchParams.get('songId')

  useEffect(() => {
    if (songId && user) {
      loadSongData(songId)
    }
  }, [songId, user])

  useEffect(() => {
    // Inicializar AudioContext
    if (typeof window !== 'undefined') {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      setAudioContext(ctx)
      
      // Crear master gain node
      const masterGain = ctx.createGain()
      masterGain.connect(ctx.destination)
      masterGainRef.current = masterGain
    }

  }, [])

  const loadSongData = async (songId: string) => {
    try {
      setIsLoading(true)
      const songs = await getUserSongs(user!.uid)
      const song = songs.find(s => s.id === songId)
      
      if (!song) {
        console.error('Canción no encontrada')
        router.push('/')
        return
      }

      setSelectedSong(song)
      
      // Crear tracks desde los stems
      if (song.stems) {
        const tracks: TrackData[] = Object.entries(song.stems).map(([name, url]) => ({
          name: getTrackDisplayName(name),
          url: url || '',
          volume: 0.8,
          muted: false,
          solo: false,
          pan: 0,
          eq: { low: 0, mid: 0, high: 0 },
          effects: { reverb: 0, delay: 0, distortion: 0 }
        }))
        
        setMixerState(prev => ({ ...prev, tracks }))
        await initializeAudioTracks(tracks)
      }
    } catch (error) {
      console.error('Error cargando canción:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getTrackDisplayName = (name: string): string => {
    const displayNames: { [key: string]: string } = {
      'vocals': 'Vocals',
      'instrumental': 'Instrumental',
      'drums': 'Drums',
      'bass': 'Bass',
      'guitar': 'Guitar',
      'piano': 'Piano',
      'strings': 'Strings',
      'brass': 'Brass',
      'percussion': 'Percussion',
      'synth': 'Synth'
    }
    return displayNames[name] || name.charAt(0).toUpperCase() + name.slice(1)
  }

  const getTrackIcon = (name: string) => {
    const icons: { [key: string]: React.ReactNode } = {
      'Vocals': <Mic className="w-4 h-4" />,
      'Instrumental': <Music className="w-4 h-4" />,
      'Drums': <Drum className="w-4 h-4" />,
      'Bass': <Guitar className="w-4 h-4" />,
      'Guitar': <Guitar className="w-4 h-4" />,
      'Piano': <Piano className="w-4 h-4" />,
      'Strings': <Music className="w-4 h-4" />,
      'Brass': <Music className="w-4 h-4" />,
      'Percussion': <Drum className="w-4 h-4" />,
      'Synth': <Zap className="w-4 h-4" />
    }
    return icons[name] || <Music className="w-4 h-4" />
  }

  const initializeAudioTracks = async (tracks: TrackData[]) => {
    if (!audioContext) return

    const newGainNodes: { [key: string]: GainNode } = {}
    const newAudioElements: { [key: string]: HTMLAudioElement } = {}

    for (const track of tracks) {
      try {
        // Crear elemento de audio
        const audio = new Audio(track.url)
        audio.crossOrigin = 'anonymous'
        audio.loop = false
        
        // Crear gain node para este track
        const gainNode = audioContext.createGain()
        gainNode.gain.value = track.volume
        
        // Conectar al master gain
        if (masterGainRef.current) {
          gainNode.connect(masterGainRef.current)
        }
        
        newGainNodes[track.name] = gainNode
        newAudioElements[track.name] = audio
        
        // Conectar audio al gain node
        const source = audioContext.createMediaElementSource(audio)
        source.connect(gainNode)
        
      } catch (error) {
        console.error(`Error inicializando track ${track.name}:`, error)
      }
    }

    setGainNodes(newGainNodes)
    setAudioElements(newAudioElements)
  }

  const togglePlayPause = () => {
    if (mixerState.isPlaying) {
      // Pausar todos los tracks
      Object.values(audioElements).forEach(audio => {
        audio.pause()
      })
      setMixerState(prev => ({ ...prev, isPlaying: false }))
    } else {
      // Reproducir todos los tracks
      Object.values(audioElements).forEach(audio => {
        audio.play()
      })
      setMixerState(prev => ({ ...prev, isPlaying: true }))
    }
  }

  const stopPlayback = () => {
    Object.values(audioElements).forEach(audio => {
      audio.pause()
      audio.currentTime = 0
    })
    setMixerState(prev => ({ 
      ...prev, 
      isPlaying: false
    }))
  }


  const updateTrackVolume = (trackName: string, volume: number) => {
    const gainNode = gainNodes[trackName]
    if (gainNode) {
      gainNode.gain.value = volume
    }
    
    setMixerState(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => 
        track.name === trackName ? { ...track, volume } : track
      )
    }))
  }

  const toggleTrackMute = (trackName: string) => {
    const gainNode = gainNodes[trackName]
    if (gainNode) {
      gainNode.gain.value = gainNode.gain.value > 0 ? 0 : 0.8
    }
    
    setMixerState(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => 
        track.name === trackName 
          ? { ...track, muted: !track.muted, volume: track.muted ? 0.8 : 0 }
          : track
      )
    }))
  }

  const toggleTrackSolo = (trackName: string) => {
    setMixerState(prev => {
      const newTracks = prev.tracks.map(track => {
        if (track.name === trackName) {
          return { ...track, solo: !track.solo }
        } else if (track.solo) {
          // Si otro track está en solo, quitarlo
          return { ...track, solo: false }
        }
        return track
      })
      
      // Aplicar lógica de solo
      newTracks.forEach(track => {
        const gainNode = gainNodes[track.name]
        if (gainNode) {
          const hasSolo = newTracks.some(t => t.solo)
          if (hasSolo) {
            gainNode.gain.value = track.solo ? track.volume : 0
          } else {
            gainNode.gain.value = track.muted ? 0 : track.volume
          }
        }
      })
      
      return { ...prev, tracks: newTracks }
    })
  }

  const updateMasterVolume = (volume: number) => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = volume
    }
    setMixerState(prev => ({ ...prev, masterVolume: volume }))
  }


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Music className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-white text-lg">Cargando mixer...</p>
        </div>
      </div>
    )
  }

  if (!selectedSong) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Canción no encontrada</h1>
          <button
            onClick={() => router.push('/')}
            className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-lg"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-black border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">{selectedSong.title}</h1>
              <p className="text-gray-400">{selectedSong.artist}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={togglePlayPause}
              className="bg-teal-500 hover:bg-teal-600 text-white p-3 rounded-full transition-colors"
            >
              {mixerState.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button
              onClick={stopPlayback}
              className="bg-gray-600 hover:bg-gray-500 text-white p-3 rounded-full transition-colors"
            >
              <Square className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                Object.values(audioElements).forEach(audio => {
                  audio.currentTime = 0
                })
              }}
              className="bg-gray-600 hover:bg-gray-500 text-white p-3 rounded-full transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
        
      </div>

      {/* Mixer Interface */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Tracks */}
          {mixerState.tracks.map((track) => (
            <div key={track.name} className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  {getTrackIcon(track.name)}
                  <span className="text-white font-medium">{track.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleTrackSolo(track.name)}
                    className={`p-1 rounded ${
                      track.solo 
                        ? 'bg-yellow-500 text-black' 
                        : 'bg-gray-600 text-white hover:bg-gray-500'
                    }`}
                    title="Solo"
                  >
                    S
                  </button>
                  <button
                    onClick={() => toggleTrackMute(track.name)}
                    className={`p-1 rounded ${
                      track.muted 
                        ? 'bg-red-500 text-white' 
                        : 'bg-gray-600 text-white hover:bg-gray-500'
                    }`}
                    title="Mute"
                  >
                    M
                  </button>
                </div>
              </div>
              
              {/* Volume Control */}
              <div className="space-y-3">
                <div>
                  <label className="text-gray-300 text-sm">Volumen</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={track.volume}
                    onChange={(e) => updateTrackVolume(track.name, parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-gray-400 text-xs mt-1">
                    {Math.round(track.volume * 100)}%
                  </div>
                </div>
                
                {/* Pan Control */}
                <div>
                  <label className="text-gray-300 text-sm">Pan</label>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={track.pan}
                    onChange={(e) => {
                      setMixerState(prev => ({
                        ...prev,
                        tracks: prev.tracks.map(t => 
                          t.name === track.name 
                            ? { ...t, pan: parseFloat(e.target.value) }
                            : t
                        )
                      }))
                    }}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-gray-400 text-xs mt-1">
                    {track.pan === 0 ? 'C' : track.pan > 0 ? `R${track.pan}` : `L${Math.abs(track.pan)}`}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Master Controls */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-white text-lg font-semibold mb-4">Master Controls</h3>
          <div className="flex items-center space-x-6">
            <div className="flex-1">
              <label className="text-gray-300 text-sm">Master Volume</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={mixerState.masterVolume}
                onChange={(e) => updateMasterVolume(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-gray-400 text-xs mt-1">
                {Math.round(mixerState.masterVolume * 100)}%
              </div>
            </div>
            
            <button
              onClick={() => setMixerState(prev => ({ ...prev, masterMuted: !prev.masterMuted }))}
              className={`p-3 rounded-lg ${
                mixerState.masterMuted 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-600 text-white hover:bg-gray-500'
              }`}
            >
              {mixerState.masterMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MixerPage
