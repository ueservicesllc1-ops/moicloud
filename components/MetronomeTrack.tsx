'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'

interface MetronomeTrackProps {
  bpm: number
  isPlaying: boolean
  currentTime: number
  onVolumeChange: (volume: number) => void
  onMuteChange: (muted: boolean) => void
  volume: number
  muted: boolean
}

export default function MetronomeTrack({ 
  bpm, 
  isPlaying, 
  currentTime, 
  onVolumeChange, 
  onMuteChange, 
  volume, 
  muted 
}: MetronomeTrackProps) {
  const [isMetronomeActive, setIsMetronomeActive] = useState(false)
  const [accentBeat, setAccentBeat] = useState(1) // Beat acentuado (1 = primer beat)
  const [timeSignature, setTimeSignature] = useState(4) // 4/4 por defecto
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const nextClickTimeRef = useRef<number>(0)
  const clickIntervalRef = useRef<number | null>(null)
  const isPlayingRef = useRef(false)

  // Inicializar AudioContext
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      gainNodeRef.current = audioContextRef.current.createGain()
      gainNodeRef.current.connect(audioContextRef.current.destination)
    }
  }, [])

  // Generar sonido de click
  const generateClickSound = useCallback((isAccent: boolean = false) => {
    if (!audioContextRef.current || !gainNodeRef.current) return

    const ctx = audioContextRef.current
    const gainNode = gainNodeRef.current
    
    // Configuración del sonido
    const frequency = isAccent ? 1000 : 800 // Frecuencia más alta para el acento
    const duration = 0.1 // 100ms
    const oscillator = ctx.createOscillator()
    const envelope = ctx.createGain()
    
    // Conectar nodos
    oscillator.connect(envelope)
    envelope.connect(gainNode)
    
    // Configurar oscilador
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)
    
    // Envelope (ADSR)
    const now = ctx.currentTime
    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(isAccent ? 0.3 : 0.2, now + 0.01)
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration)
    
    // Reproducir
    oscillator.start(now)
    oscillator.stop(now + duration)
  }, [])

  // Calcular tiempo entre clicks
  const getClickInterval = useCallback(() => {
    return 60 / bpm // segundos entre clicks
  }, [bpm])

  // Programar siguiente click
  const scheduleNextClick = useCallback(() => {
    if (!audioContextRef.current || !isPlayingRef.current) return

    const ctx = audioContextRef.current
    const interval = getClickInterval()
    const currentTime = ctx.currentTime
    
    // Calcular cuántos clicks necesitamos programar
    const lookahead = 0.1 // 100ms de anticipación
    const endTime = currentTime + lookahead
    
    while (nextClickTimeRef.current < endTime) {
      const clickTime = nextClickTimeRef.current
      const beatNumber = Math.floor((clickTime - currentTime) / interval) + 1
      const isAccent = (beatNumber % timeSignature) === 1
      
      // Programar el click
      ctx.suspend()
      setTimeout(() => {
        if (audioContextRef.current) {
          audioContextRef.current.resume()
          generateClickSound(isAccent)
        }
      }, (clickTime - currentTime) * 1000)
      
      nextClickTimeRef.current += interval
    }
  }, [bpm, timeSignature, generateClickSound, getClickInterval])

  // Iniciar metronome
  const startMetronome = useCallback(() => {
    if (!audioContextRef.current || isPlayingRef.current) return

    isPlayingRef.current = true
    nextClickTimeRef.current = audioContextRef.current.currentTime
    
    const scheduleClicks = () => {
      if (isPlayingRef.current) {
        scheduleNextClick()
        clickIntervalRef.current = window.setTimeout(scheduleClicks, 25) // 25ms
      }
    }
    
    scheduleClicks()
  }, [scheduleNextClick])

  // Detener metronome
  const stopMetronome = useCallback(() => {
    isPlayingRef.current = false
    if (clickIntervalRef.current) {
      clearTimeout(clickIntervalRef.current)
      clickIntervalRef.current = null
    }
  }, [])

  // Controlar metronome cuando cambia el estado de reproducción
  useEffect(() => {
    if (isMetronomeActive && isPlaying) {
      startMetronome()
    } else {
      stopMetronome()
    }
  }, [isMetronomeActive, isPlaying, startMetronome, stopMetronome])

  // Actualizar volumen del metronome
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = muted ? 0 : volume
    }
  }, [volume, muted])

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopMetronome()
    }
  }, [stopMetronome])

  return (
    <div className="h-[12%] border-b border-gray-600 flex flex-col items-start justify-between p-2 bg-gray-800">
      {/* Header del track */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-yellow-500 rounded flex items-center justify-center">
            <span className="text-black text-xs font-bold">M</span>
          </div>
          <span className="text-white text-sm font-medium">Metronome</span>
          <span className="text-gray-400 text-xs">({bpm} BPM)</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Toggle metronome */}
          <button
            onClick={() => setIsMetronomeActive(!isMetronomeActive)}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isMetronomeActive 
                ? 'bg-yellow-500 text-black' 
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
            title={isMetronomeActive ? "Desactivar metronome" : "Activar metronome"}
          >
            {isMetronomeActive ? '⏸' : '▶'}
          </button>
          
          {/* Mute button */}
          <button
            onClick={() => onMuteChange(!muted)}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              muted 
                ? 'bg-red-500 text-white' 
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
            title={muted ? "Unmute metronome" : "Mute metronome"}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>
      
      {/* Controles */}
      <div className="flex items-center space-x-4 w-full">
        {/* Volumen */}
        <div className="flex items-center space-x-2">
          <span className="text-white text-xs">Vol</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={muted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-16 h-1 bg-gray-600 appearance-none cursor-pointer accent-yellow-400"
          />
          <span className="text-white text-xs w-6">
            {Math.round((muted ? 0 : volume) * 100)}%
          </span>
        </div>
        
        {/* Time Signature */}
        <div className="flex items-center space-x-2">
          <span className="text-white text-xs">Sig</span>
          <select
            value={timeSignature}
            onChange={(e) => setTimeSignature(parseInt(e.target.value))}
            className="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600"
          >
            <option value={3}>3/4</option>
            <option value={4}>4/4</option>
            <option value={6}>6/8</option>
          </select>
        </div>
        
        {/* BPM Display */}
        <div className="flex items-center space-x-2">
          <span className="text-white text-xs">BPM</span>
          <div className="bg-black px-2 py-1 rounded">
            <span className="text-yellow-400 text-xs font-mono">{bpm}</span>
          </div>
        </div>
      </div>
    </div>
  )
}



