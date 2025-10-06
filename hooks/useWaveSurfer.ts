import { useEffect, useRef, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'

interface UseWaveSurferOptions {
  audioUrl?: string
  onReady?: () => void
  onPlay?: () => void
  onPause?: () => void
  onFinish?: () => void
  onTimeUpdate?: (time: number) => void
  onRegionCreated?: (region: any) => void
  onRegionUpdated?: (region: any) => void
  onRegionRemoved?: (region: any) => void
}

export const useWaveSurfer = (options: UseWaveSurferOptions = {}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const timelinePluginRef = useRef<any>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isReady, setIsReady] = useState(false)

  // Inicializar WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4f46e5',
      progressColor: '#7c3aed',
      cursorColor: '#f59e0b',
      barWidth: 2,
      barRadius: 3,
      height: 100,
      normalize: true,
      backend: 'WebAudio',
      plugins: []
    })

    // Plugin de timeline
    const timelinePlugin = TimelinePlugin.create({
      height: 30,
      insertPosition: 'beforebegin',
      timeInterval: 0.2,
      primaryLabelInterval: 5,
      secondaryLabelInterval: 1,
      style: {
        fontSize: '10px',
        color: '#fff'
      }
    })

    wavesurfer.registerPlugin(timelinePlugin)

    wavesurferRef.current = wavesurfer
    timelinePluginRef.current = timelinePlugin

    // Event listeners
    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration())
      setIsReady(true)
      options.onReady?.()
    })

    wavesurfer.on('audioprocess', (time) => {
      setCurrentTime(time)
      options.onTimeUpdate?.(time)
    })

    wavesurfer.on('play', () => {
      setIsPlaying(true)
      options.onPlay?.()
    })

    wavesurfer.on('pause', () => {
      setIsPlaying(false)
      options.onPause?.()
    })

    wavesurfer.on('finish', () => {
      setIsPlaying(false)
      options.onFinish?.()
    })


    // Cargar audio si está disponible
    if (options.audioUrl) {
      wavesurfer.load(options.audioUrl)
    }

    return () => {
      wavesurfer.destroy()
    }
  }, [options.audioUrl])

  // Métodos de control
  const play = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.play()
    }
  }, [])

  const pause = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.pause()
    }
  }, [])

  const playPause = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }, [])

  const stop = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.stop()
    }
  }, [])

  const seekTo = useCallback((time: number) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(time / duration)
    }
  }, [duration])

  const setTime = useCallback((time: number) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(time / duration)
    }
  }, [duration])

  const zoom = useCallback((pixelsPerSecond: number) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.zoom(pixelsPerSecond)
    }
  }, [])


  return {
    containerRef,
    wavesurfer: wavesurferRef.current,
    isPlaying,
    currentTime,
    duration,
    isReady,
    play,
    pause,
    playPause,
    stop,
    seekTo,
    setTime,
    zoom,
  }
}