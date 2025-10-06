'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import MetronomeTrack from '@/components/MetronomeTrack'
import { 
  Music, 
  Search,
  Plus,
  ChevronDown,
  User,
  Volume2,
  LogOut,
  Cloud,
  Trash2,
  Zap,
  Target,
  Repeat,
  VolumeX,
  X,
  MoreVertical,
  Play,
  Pause,
  SkipBack,
  SkipForward
} from 'lucide-react'
import NewSongUpload from '@/components/NewSongUpload'
import MoisesStyleUpload from '@/components/MoisesStyleUpload'
import ConnectionStatus from '@/components/ConnectionStatus'
import { getUserSongs, subscribeToUserSongs, deleteSong, Song } from '@/lib/firestore'
import useAudioCleanup from '@/hooks/useAudioCleanup'

export default function Home() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  
  // Hook para limpiar audio
  useAudioCleanup()
  const [activeTab, setActiveTab] = useState('my-songs')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('added')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [songs, setSongs] = useState<Song[]>([])
  const [songsLoading, setSongsLoading] = useState(true)
  const [showAudioEditor, setShowAudioEditor] = useState(false)
  const [selectedSongForEditor, setSelectedSongForEditor] = useState<Song | null>(null)
  const [showSongModal, setShowSongModal] = useState(false)
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [audioElements, setAudioElements] = useState<{ [key: string]: HTMLAudioElement }>({})
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [waveforms, setWaveforms] = useState<{ [key: string]: number[] }>({})
  const [trackOnsets, setTrackOnsets] = useState<{ [key: string]: number }>({}) // Onset en ms de cada track
  
  // Cache global para audio buffers y waveforms
  const [audioCache, setAudioCache] = useState<{ [url: string]: { audioBuffer: AudioBuffer, waveform: number[] } }>({})
  const [trackLoadingStates, setTrackLoadingStates] = useState<{ [key: string]: 'idle' | 'loading' | 'cached' | 'ready' }>({})
  const [waveformCache, setWaveformCache] = useState<{ [url: string]: number[] }>({})
  const [cacheLoaded, setCacheLoaded] = useState(false)
  
  // Estados para el selector de colores de tracks
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null)
  const [trackColors, setTrackColors] = useState<{ [key: string]: string }>({})
  
  // Estado para el menú dropdown de acciones
  const [showDropdown, setShowDropdown] = useState<string | null>(null)
  
  // Estados para controles de audio
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [trackMutedStates, setTrackMutedStates] = useState<{ [key: string]: boolean }>({})
  const [trackSoloStates, setTrackSoloStates] = useState<{ [key: string]: boolean }>({})
  
  // Estado para estilo de waveform
  const [waveformStyle, setWaveformStyle] = useState<'bars' | 'smooth' | 'dots'>('bars')

  // Estados para metronome
  const [metronomeLoaded, setMetronomeLoaded] = useState(false)
  const [metronomePlaying, setMetronomePlaying] = useState(false)
  
  // Set para rastrear canciones siendo procesadas para duración
  const [processingDurations, setProcessingDurations] = useState<Set<string>>(new Set())
  
  // Estado para controlar reproducción de click tracks
  const [playingClickTrack, setPlayingClickTrack] = useState<{ songId: string, audio: HTMLAudioElement } | null>(null)
  
  // Estados para el metrónomo automático
  const [metronomeMuted, setMetronomeMuted] = useState<boolean>(false)
  const metronomeMutedRef = useRef<boolean>(false)
  const [metronomeInterval, setMetronomeInterval] = useState<NodeJS.Timeout | null>(null)
  const [metronomeStartTime, setMetronomeStartTime] = useState<number>(0)
  const [songFirstBeat, setSongFirstBeat] = useState<number>(0) // Primer golpe en ms
  
  // Función para detectar el primer golpe de sonido de la canción
  const detectSongFirstBeat = async (song: Song): Promise<number> => {
    try {
      console.log('[METRONOME] Detectando primer golpe de sonido...');
      
      // Usar el audio original para detectar el primer ataque
      const audio = new Audio(song.fileUrl);
      
      return new Promise((resolve) => {
        audio.onloadedmetadata = async () => {
          try {
            // Crear contexto de audio para análisis
            const audioContext = new AudioContext();
            const response = await fetch(song.fileUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Detectar primer ataque usando RMS
            const channelData = audioBuffer.getChannelData(0);
            const sampleRate = audioContext.sampleRate;
            const windowSizeMs = 50; // Ventana más pequeña para detección precisa
            const windowSize = Math.floor((windowSizeMs / 1000) * sampleRate);
            const threshold = 0.02; // Umbral más sensible
            
            for (let i = 0; i < channelData.length; i += windowSize) {
              const end = Math.min(i + windowSize, channelData.length);
              let sum = 0;
              for (let j = i; j < end; j++) {
                sum += channelData[j] * channelData[j];
              }
              const rms = Math.sqrt(sum / (end - i));
              
              if (rms > threshold) {
                const timeSeconds = i / sampleRate;
                const timeMs = Math.round(timeSeconds * 1000);
                console.log(`[METRONOME] ✅ Primer golpe detectado en: ${timeMs}ms`);
                resolve(timeMs);
                return;
              }
            }
            
            // Si no se detecta, usar 0
            console.log('[METRONOME] ⚠️ No se detectó primer golpe, usando 0ms');
            resolve(0);
          } catch (error) {
            console.error('[METRONOME] Error detectando primer golpe:', error);
            resolve(0);
          }
        };
        
        audio.onerror = () => {
          console.error('[METRONOME] Error cargando audio para detección');
          resolve(0);
        };
      });
    } catch (error) {
      console.error('[METRONOME] Error en detectSongFirstBeat:', error);
      return 0;
    }
  };
  
  // Función para iniciar metrónomo automáticamente cuando empieza la reproducción
  const startMetronome = async () => {
    if (!selectedSong) return;
    
    // Usar el onset mínimo de los tracks existentes en lugar de detectar desde audio original
    let firstBeat = songFirstBeat;
    if (firstBeat === 0 && Object.keys(trackOnsets).length > 0) {
      // Obtener el menor onset de todos los tracks (excluyendo click)
      const nonClickOnsets = Object.entries(trackOnsets)
        .filter(([trackKey]) => trackKey !== 'click')
        .map(([_, onsetMs]) => onsetMs)
        .filter(onsetMs => onsetMs !== undefined && onsetMs > 0);
      
      if (nonClickOnsets.length > 0) {
        firstBeat = Math.min(...nonClickOnsets);
        console.log(`[METRONOME] Usando onset mínimo de tracks: ${firstBeat}ms`);
      } else {
        console.log('[METRONOME] No hay onsets de tracks, detectando desde audio original...');
        firstBeat = await detectSongFirstBeat(selectedSong);
      }
      setSongFirstBeat(firstBeat);
    }
    
    // Calcular intervalo del metrónomo basado en BPM
    const bpm = selectedSong.bpm || 120;
    const beatIntervalMs = 60000 / bpm; // ms por beat
    
    console.log(`[METRONOME] Iniciando automáticamente con BPM: ${bpm}, intervalo: ${beatIntervalMs}ms, primer golpe: ${firstBeat}ms, muteado: ${metronomeMuted}`);
    
    // Configurar metrónomo
    setMetronomeStartTime(Date.now());
    
    // Crear intervalo para clicks regulares - más preciso
    let clickCount = 0;
    let lastClickTime = 0;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - metronomeStartTime;
      
      // Solo hacer click si ya pasó el primer golpe y es tiempo para el próximo
      if (elapsed >= firstBeat) {
        const timeSinceFirstBeat = elapsed - firstBeat;
        const expectedClickTime = Math.floor(timeSinceFirstBeat / beatIntervalMs) * beatIntervalMs;
        
        // Solo hacer click si es un nuevo beat (no el mismo que el anterior)
        if (expectedClickTime > lastClickTime && expectedClickTime >= 0) {
          lastClickTime = expectedClickTime;
          clickCount++;
          
          // Crear nuevo click
          const clickContext = new AudioContext();
          const clickOsc = clickContext.createOscillator();
          const clickGain = clickContext.createGain();
          
          clickOsc.connect(clickGain);
          clickGain.connect(clickContext.destination);
          
          clickOsc.frequency.setValueAtTime(1000, clickContext.currentTime);
          clickOsc.type = 'sine';
          
          // Usar el volumen actual del metrónomo (se actualiza dinámicamente)
          const currentVolume = metronomeMutedRef.current ? 0 : 0.3;
          clickGain.gain.setValueAtTime(0, clickContext.currentTime);
          clickGain.gain.linearRampToValueAtTime(currentVolume, clickContext.currentTime + 0.01);
          clickGain.gain.exponentialRampToValueAtTime(0.01, clickContext.currentTime + 0.1);
          
          clickOsc.start(clickContext.currentTime);
          clickOsc.stop(clickContext.currentTime + 0.1);
          
          console.log(`[METRONOME] Click ${clickCount} en ${elapsed}ms (beat ${expectedClickTime}ms)`);
        }
      }
    }, 25); // Check cada 25ms para mayor precisión
    
    setMetronomeInterval(interval);
    console.log('[METRONOME] ✅ Iniciado automáticamente');
  };
  
  // Función para detener metrónomo
  const stopMetronome = () => {
    if (metronomeInterval) {
      clearInterval(metronomeInterval);
      setMetronomeInterval(null);
    }
    console.log('[METRONOME] Detenido');
  };
  
  // Función para toggle mute del metrónomo
  const toggleMetronomeMute = () => {
    const newMuted = !metronomeMuted;
    setMetronomeMuted(newMuted);
    metronomeMutedRef.current = newMuted;
    
    console.log(`[METRONOME] ${newMuted ? 'Silenciado' : 'Activado'} - Volumen: ${newMuted ? 0 : 0.3}`);
  };
  
  // Función para renderizar click track como stem
  const renderClickTrack = async () => {
    if (!selectedSong || !selectedSong.bpm || !selectedSong.durationSeconds) {
      console.log('[RENDER] Falta BPM o duración para renderizar click track');
      return;
    }
    
    try {
      console.log('[RENDER] ==================== RENDERIZANDO CLICK TRACK ====================');
      console.log(`[RENDER] Canción: ${selectedSong.title}`);
      console.log(`[RENDER] BPM: ${selectedSong.bpm}, Duración: ${selectedSong.durationSeconds}s`);
      
      const response = await fetch('http://localhost:8000/api/generate-click-track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bpm: selectedSong.bpm,
          duration_seconds: selectedSong.durationSeconds,
          time_signature: selectedSong.timeSignature || '4/4',
          song_id: selectedSong.id,
          user_id: user?.uid,
          audio_url: selectedSong.fileUrl,
          silence_ms: songFirstBeat // Usar el primer golpe detectado
        }),
      });

      const data = await response.json();

      if (data.success && data.click_url) {
        // Actualizar en Firestore
        const { updateDoc, doc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        const updatedStems = {
          ...selectedSong.stems,
          click: data.click_url
        };
        
        const clickMetadata = {
          name: 'Click Track',
          bpm: selectedSong.bpm,
          timeSignature: selectedSong.timeSignature || '4/4',
          duration: selectedSong.duration,
          durationSeconds: selectedSong.durationSeconds,
          generatedAt: new Date().toISOString(),
          onsetOffsetSeconds: data.onset_offset_seconds || 0
        };
        
        await updateDoc(doc(db, 'songs', selectedSong.id!), {
          stems: updatedStems,
          clickMetadata: clickMetadata
        });
        
        console.log('[RENDER] ✅ Click track renderizado y guardado exitosamente');
        
        // Actualizar el estado local
        const updatedSong = {
          ...selectedSong,
          stems: updatedStems,
          clickMetadata: clickMetadata
        };
        
        setSelectedSong(updatedSong);
        setSongs(prev => prev.map(s => 
          s.id === selectedSong.id 
            ? updatedSong
            : s
        ));
        
        // Cargar el nuevo click track
        setTimeout(() => {
          console.log('[RENDER] Cargando click track renderizado...');
          loadAudioFiles(updatedSong);
        }, 1000);
        
      } else {
        console.error('[RENDER] Error renderizando click track:', data);
      }
    } catch (error) {
      console.error('[RENDER] Error:', error);
    }
  };
  
  
  

  // Cargar cache persistente al inicializar
  useEffect(() => {
    const savedCache = localStorage.getItem('waveform-cache')
    if (savedCache) {
      try {
        const parsedCache = JSON.parse(savedCache)
        setWaveformCache(parsedCache)
        setCacheLoaded(true)
        console.log('Cache cargado desde localStorage:', Object.keys(parsedCache).length, 'entradas')
      } catch (error) {
        console.error('Error cargando cache:', error)
        setCacheLoaded(true)
      }
    } else {
      setCacheLoaded(true)
    }
  }, [])
  
  // Limpiar metrónomo cuando se cierre el modal
  useEffect(() => {
    if (!showSongModal) {
      stopMetronome();
      setSongFirstBeat(0);
      setMetronomeMuted(false);
      metronomeMutedRef.current = false;
    }
  }, [showSongModal])
  

  // Cargar metronome cuando se selecciona una canción
  useEffect(() => {
    if (selectedSong && selectedSong.bpm) {
      console.log('🎵 Cargando metronome para:', selectedSong.title, 'BPM:', selectedSong.bpm)
      setMetronomeLoaded(true)
    } else {
      setMetronomeLoaded(false)
    }
  }, [selectedSong])

  // Debug metronome state changes
  useEffect(() => {
    console.log('🎵 Metronome state changed:', {
      playing: metronomePlaying,
      loaded: metronomeLoaded,
      muted: metronomeMuted,
      volume: metronomeMuted ? 0 : 0.3,
      bpm: selectedSong?.bpm
    });
  }, [metronomePlaying, metronomeLoaded, metronomeMuted, selectedSong?.bpm])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDropdown) {
        setShowDropdown(null)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])


  // Cargar canciones reales desde Firestore
  useEffect(() => {
    if (!user) {
      console.log('No user, skipping songs load')
      return
    }

    console.log('Loading songs for user:', user.uid)
    setSongsLoading(true)
    
    // Suscribirse a cambios en tiempo real
    const unsubscribe = subscribeToUserSongs(user.uid, (userSongs) => {
      console.log('Received songs in UI:', userSongs.length)
      setSongs(userSongs)
      setSongsLoading(false)
    })

    return () => {
      console.log('🧹 Unsubscribing from songs')
      unsubscribe()
    }
  }, [user])

  // Calcular automáticamente las duraciones, BPM y Key faltantes
  useEffect(() => {
    const calculateMissingData = async () => {
      // Filtrar canciones que necesitan algún dato
      const songsNeedingData = songs.filter(song => 
        song.fileUrl && 
        song.id &&
        (
          (!song.duration || song.duration === '0:00') ||
          !song.bpm ||
          !song.key || song.key === '-' ||
          !song.timeSignature
        ) &&
        !processingDurations.has(song.id)
      );

      if (songsNeedingData.length === 0) return;

      console.log(`🔄 Calculando datos faltantes para ${songsNeedingData.length} canciones...`);

      // Marcar canciones como procesándose
      setProcessingDurations(prev => {
        const newSet = new Set(prev);
        songsNeedingData.forEach(song => song.id && newSet.add(song.id));
        return newSet;
      });

      for (const song of songsNeedingData) {
        try {
          const { doc, updateDoc } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          const songRef = doc(db, 'songs', song.id!);
          const updates: any = {};
          
          // Calcular duración si falta
          if (!song.duration || song.duration === '0:00') {
            try {
              const audio = new Audio();
              audio.preload = 'metadata';
              
              await new Promise((resolve, reject) => {
                audio.onloadedmetadata = () => {
                  const durationSeconds = Math.floor(audio.duration);
                  const minutes = Math.floor(durationSeconds / 60);
                  const seconds = durationSeconds % 60;
                  const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                  
                  updates.duration = duration;
                  updates.durationSeconds = durationSeconds;
                  console.log(`✅ ${song.title} - Duración: ${duration}`);
                  resolve(true);
                };
                
                audio.onerror = () => reject(new Error('Error al cargar audio'));
                audio.src = song.fileUrl!;
              });
            } catch (error) {
              console.warn(`⚠️ No se pudo calcular duración para ${song.title}`);
            }
          }
          
          // Calcular BPM si falta
          if (!song.bpm) {
            try {
              const response = await fetch(`http://localhost:8000/api/analyze-bpm-from-url?audio_url=${encodeURIComponent(song.fileUrl!)}`);
              const data = await response.json();
              
              if (data.success && data.bpm) {
                updates.bpm = data.bpm;
                console.log(`✅ ${song.title} - BPM: ${data.bpm}`);
              }
            } catch (error) {
              console.warn(`⚠️ No se pudo calcular BPM para ${song.title}`);
            }
          }
          
          // Calcular Key si falta
          if (!song.key || song.key === '-') {
            try {
              const response = await fetch(`http://localhost:8000/api/analyze-key-from-url?audio_url=${encodeURIComponent(song.fileUrl!)}`);
              const data = await response.json();
              
              if (data.success && data.key_string) {
                updates.key = data.key_string;
                console.log(`✅ ${song.title} - Key: ${data.key_string}`);
              }
            } catch (error) {
              console.warn(`⚠️ No se pudo calcular Key para ${song.title}`);
            }
          }
          
          // Calcular Time Signature si falta
          if (!song.timeSignature) {
            try {
              const response = await fetch(`http://localhost:8000/api/analyze-time-signature-from-url?audio_url=${encodeURIComponent(song.fileUrl!)}`);
              const data = await response.json();
              
              if (data.success && data.time_signature) {
                updates.timeSignature = data.time_signature;
                console.log(`✅ ${song.title} - Time Signature: ${data.time_signature}`);
              }
            } catch (error) {
              console.warn(`⚠️ No se pudo calcular Time Signature para ${song.title}`);
            }
          }
          
          // Actualizar en Firestore si hay cambios
          if (Object.keys(updates).length > 0) {
            await updateDoc(songRef, updates);
          }
          
        } catch (error) {
          console.warn(`⚠️ Error procesando ${song.title}:`, error);
        }
      }
    };

    if (songs.length > 0 && !songsLoading) {
      calculateMissingData();
    }
  }, [songs, songsLoading, processingDurations])

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/login')
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    }
  }

  const handleUploadComplete = (newSong: Song) => {
    // La lista se actualiza automáticamente por la suscripción a Firestore
    console.log('New song uploaded:', newSong)
  }

  const handleUploadClick = () => {
    setShowUploadModal(true)
  }

  // Estados para reproducción de audio original en dashboard
  const [currentPlayingSong, setCurrentPlayingSong] = useState<string | null>(null);
  const [originalAudioElements, setOriginalAudioElements] = useState<{ [songId: string]: HTMLAudioElement }>({});
  
  // Estados para modal de Moises Style
  const [showMoisesStyleModal, setShowMoisesStyleModal] = useState(false);

  // Función para reproducir audio original
  const handlePlayOriginalAudio = (song: Song) => {
    try {
      console.log('🎵 Reproduciendo audio original de:', song.title);
      console.log('🎵 URL del audio:', song.fileUrl);
      
      if (!song.fileUrl) {
        console.error('❌ No hay URL de audio disponible');
        alert('❌ No hay audio disponible para esta canción');
        return;
      }
      
      // Pausar cualquier audio que esté reproduciéndose
      if (currentPlayingSong && currentPlayingSong !== song.id) {
        const currentAudio = originalAudioElements[currentPlayingSong];
        if (currentAudio) {
          currentAudio.pause();
        }
      }
      
      // Si ya existe un audio para esta canción, usar ese
      let audio = originalAudioElements[song.id!];
      
      if (!audio) {
        // Crear un nuevo elemento de audio
        audio = new Audio(song.fileUrl);
        audio.crossOrigin = 'anonymous';
        
        // Event listener para cuando termine la canción original
        audio.addEventListener('ended', () => {
          console.log(`🏁 Original song ended - stopping playback`)
          audio.pause();
          audio.currentTime = 0;
          setCurrentPlayingSong(null);
        });
        
        setOriginalAudioElements(prev => ({ ...prev, [song.id!]: audio }));
      }
      
      // Si el audio ya está reproduciéndose, pausarlo
      if (currentPlayingSong === song.id && !audio.paused) {
        audio.pause();
        setCurrentPlayingSong(null);
        return;
      }
      
      // Reproducir el audio
      audio.play().then(() => {
        setCurrentPlayingSong(song.id!);
        console.log('✅ Audio original reproduciéndose:', song.title);
      }).catch(error => {
        console.error('❌ Error al iniciar reproducción:', error);
        alert('❌ Error: No se puede iniciar la reproducción del audio');
      });
      
    } catch (error) {
      console.error('❌ Error en handlePlayOriginalAudio:', error);
      alert('❌ Error al intentar reproducir el audio original');
    }
  };

  // Función para parar audio original
  const handleStopOriginalAudio = (song: Song) => {
    try {
      const audio = originalAudioElements[song.id!];
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        setCurrentPlayingSong(null);
        console.log('⏹️ Audio original detenido:', song.title);
      }
    } catch (error) {
      console.error('❌ Error deteniendo audio original:', error);
    }
  };

  const handleDeleteSong = async (songId: string, songTitle: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar "${songTitle}"? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      console.log('Deleting song:', songId)
      await deleteSong(songId)
      console.log('Song deleted successfully')
      // La lista se actualizará automáticamente por la suscripción a Firestore
    } catch (error) {
      console.error('Error deleting song:', error)
      alert('Error al eliminar la canción. Por favor, inténtalo de nuevo.')
    }
  }

  // Función para crear waveform SVG suave rellena
  const createSmoothWaveformSVG = (waveformData: number[], width: number, height: number, color: string): string => {
    if (waveformData.length === 0) return '';
    
    const centerY = height / 2;
    const points = waveformData.map((value, index) => {
      const x = (index / (waveformData.length - 1)) * width;
      const yTop = centerY - (value * height * 0.4);
      const yBottom = centerY + (value * height * 0.4);
      return { x, yTop, yBottom };
    });
    
    // Crear curva suave superior
    let topPath = `M ${points[0].x},${centerY}`;
    for (let i = 1; i < points.length; i++) {
      const [x, y] = [points[i].x, points[i].yTop];
      const [prevX, prevY] = [points[i - 1].x, points[i - 1].yTop];
      const cpX = (prevX + x) / 2;
      topPath += ` Q ${cpX},${prevY} ${x},${y}`;
    }
    
    // Crear curva suave inferior (en reversa)
    let bottomPath = ` L ${points[points.length - 1].x},${points[points.length - 1].yBottom}`;
    for (let i = points.length - 2; i >= 0; i--) {
      const [x, y] = [points[i].x, points[i].yBottom];
      const [nextX, nextY] = [points[i + 1].x, points[i + 1].yBottom];
      const cpX = (nextX + x) / 2;
      bottomPath += ` Q ${cpX},${nextY} ${x},${y}`;
    }
    bottomPath += ` Z`;
    
    const filledPath = topPath + bottomPath;
    
    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="smoothWaveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:0.9" />
            <stop offset="50%" style="stop-color:${color};stop-opacity:0.7" />
            <stop offset="100%" style="stop-color:${color};stop-opacity:0.4" />
          </linearGradient>
        </defs>
        <path d="${filledPath}" fill="url(#smoothWaveGradient)" stroke="${color}" stroke-width="1" stroke-linecap="round"/>
      </svg>
    `;
  };

  // Función para generar path SVG relleno
  const generateFilledWaveformPath = (waveformData: number[]): string => {
    if (!waveformData || waveformData.length === 0) return '';
    
    const points = waveformData.map((value, index) => {
      const x = 2 + (index / (waveformData.length - 1)) * 798;
      const yTop = 30 - (value * 25);
      const yBottom = 30 + (value * 25);
      return { x, yTop, yBottom };
    });
    
    // Crear path cerrado para relleno
    let path = `M 2,30`;
    // Línea superior
    points.forEach(point => {
      path += ` L ${point.x},${point.yTop}`;
    });
    // Línea inferior (en reversa)
    for (let i = points.length - 1; i >= 0; i--) {
      path += ` L ${points[i].x},${points[i].yBottom}`;
    }
    path += ` Z`; // Cerrar el path
    return path;
  };

  // Función profesional para generar waveform de alta precisión
  const generateProfessionalWaveform = (channelData: Float32Array, targetLength: number): number[] => {
    const sourceLength = channelData.length;
    const samplesPerPixel = sourceLength / targetLength;
    const waveform: number[] = [];
    
    for (let i = 0; i < targetLength; i++) {
      const start = Math.floor(i * samplesPerPixel);
      const end = Math.floor((i + 1) * samplesPerPixel);
      
      let max = -Infinity;
      let min = Infinity;
      let sumSquares = 0;
      let sampleCount = 0;
      
      // Procesar cada muestra en el bloque
      for (let j = start; j < end && j < sourceLength; j++) {
        const sample = channelData[j];
        max = Math.max(max, sample);
        min = Math.min(min, sample);
        sumSquares += sample * sample;
        sampleCount++;
      }
      
      if (sampleCount > 0) {
        // Calcular RMS para amplitud promedio
        const rms = Math.sqrt(sumSquares / sampleCount);
        
        // Calcular peak-to-peak para amplitud máxima
        const peakToPeak = Math.abs(max - min);
        
        // Combinar ambos métodos para representación profesional
        const amplitude = Math.max(rms * 1.8, peakToPeak * 0.6);
        waveform.push(amplitude);
      } else {
        waveform.push(0);
      }
    }
    
    // Normalización profesional - mantener la dinámica natural
    const maxAmplitude = Math.max(...waveform);
    if (maxAmplitude > 0) {
      // Aplicar compresión suave para mejor visualización
      return waveform.map(value => {
        const normalized = value / maxAmplitude;
        // Usar compresión logarítmica suave para mantener detalle
        return Math.pow(normalized, 0.7);
      });
    }
    
    return waveform;
  };


  // Función para generar click track automáticamente


  // Sistema de sincronización profesional en tiempo real
  useEffect(() => {
    console.log('🔄 useEffect sincronización - audioElements:', Object.keys(audioElements).length, 'elementos')
    
    if (Object.keys(audioElements).length > 0) {
      // Priorizar tracks que NO sean click para sincronización de tiempo
      const trackEntries = Object.entries(audioElements);
      const referenceEntry = trackEntries.find(([key]) => key !== 'click') || trackEntries[0];
      const referenceAudio = referenceEntry ? referenceEntry[1] : Object.values(audioElements)[0];
      
      if (!referenceAudio) {
        console.log('ERROR: No hay audio de referencia disponible')
        return;
      }

      console.log('OK: Configurando sincronizacion para audio:', referenceAudio.src)

      // Función de actualización de tiempo con mayor frecuencia
      const updateTime = () => {
        // Usar el click track como tiempo de referencia si existe
        let displayTime = audioElements['click'] ? audioElements['click'].currentTime : referenceAudio.currentTime;
        
        setCurrentTime(displayTime);
        // console.log('Tiempo actualizado:', displayTime, 'duracion:', referenceAudio.duration);
      };
      
      const setAudioDuration = () => {
        const newDuration = referenceAudio.duration;
        setDuration(newDuration);
        console.log('Duracion establecida:', newDuration);
      };

      // Usar requestAnimationFrame para actualizaciones más suaves
      let animationFrameId: number;
      const smoothUpdate = () => {
        updateTime();
        animationFrameId = requestAnimationFrame(smoothUpdate);
      };

      // Eventos de audio
      referenceAudio.addEventListener("timeupdate", updateTime);
      referenceAudio.addEventListener("loadedmetadata", setAudioDuration);
      referenceAudio.addEventListener("play", () => {
        smoothUpdate();
      });
      referenceAudio.addEventListener("pause", () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      });

      return () => {
        referenceAudio.removeEventListener("timeupdate", updateTime);
        referenceAudio.removeEventListener("loadedmetadata", setAudioDuration);
        referenceAudio.removeEventListener("play", smoothUpdate);
        referenceAudio.removeEventListener("pause", () => {
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
        });
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      };
    }
  }, [audioElements]);

  // Funciones para controles de audio
  const togglePlayPause = () => {
    if (isPlaying) {
      // Pausar todos los audios
      console.log('Pausing all tracks')
      Object.entries(audioElements).forEach(([trackKey, audio]) => {
        console.log(`Pausing ${trackKey}`)
        audio.pause();
      });
      setIsPlaying(false);
      
      // Metrónomo deshabilitado temporalmente
      // stopMetronome();
    } else {
      // Reproducir todos los audios sincronizados
      console.log('Playing all tracks')
      
      Object.entries(audioElements).forEach(([trackKey, audio]) => {
        audio.currentTime = currentTime;
        console.log(`PLAY ${trackKey}: empezando en ${currentTime.toFixed(3)}s`);
        
        audio.play().catch(error => {
          console.error(`Error playing ${trackKey}:`, error)
        });
      });
      
      setIsPlaying(true);
      
      // Metrónomo deshabilitado temporalmente
      // startMetronome();
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    Object.values(audioElements).forEach(audio => {
      audio.volume = newVolume;
    });
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    Object.values(audioElements).forEach(audio => {
      audio.muted = newMuted;
    });
  };

  // Función para convertir clases de Tailwind a colores CSS
  const getColorFromClass = (tailwindClass: string): string => {
    const colorMap: { [key: string]: string } = {
      'bg-gray-700': '#374151',
      'bg-gray-600': '#4B5563',
      'bg-gray-800': '#1F2937',
      'bg-gray-500': '#6B7280',
      'bg-gray-900': '#111827',
      'bg-red-600': '#DC2626',
      'bg-red-500': '#EF4444',
      'bg-red-400': '#F87171',
      'bg-red-300': '#FCA5A5',
      'bg-red-200': '#FECACA',
      'bg-blue-600': '#2563EB',
      'bg-blue-500': '#3B82F6',
      'bg-blue-400': '#60A5FA',
      'bg-blue-300': '#93C5FD',
      'bg-blue-200': '#BFDBFE',
      'bg-yellow-600': '#D97706',
      'bg-yellow-500': '#EAB308',
      'bg-yellow-400': '#FACC15',
      'bg-yellow-300': '#FDE047',
      'bg-yellow-200': '#FEF08A',
      'bg-green-600': '#16A34A',
      'bg-green-500': '#22C55E',
      'bg-green-400': '#4ADE80',
      'bg-green-300': '#86EFAC',
      'bg-green-200': '#BBF7D0',
      'bg-purple-600': '#9333EA',
      'bg-purple-500': '#A855F7',
      'bg-purple-400': '#C084FC',
      'bg-purple-300': '#D8B4FE',
      'bg-purple-200': '#E9D5FF',
      'bg-orange-600': '#EA580C',
      'bg-orange-500': '#F97316',
      'bg-orange-400': '#FB923C',
      'bg-orange-300': '#FDBA74',
      'bg-orange-200': '#FED7AA',
      'bg-pink-600': '#DB2777',
      'bg-pink-500': '#EC4899',
      'bg-pink-400': '#F472B6',
      'bg-pink-300': '#F9A8D4',
      'bg-pink-200': '#FBCFE8',
      'bg-cyan-600': '#0891B2',
      'bg-cyan-500': '#06B6D4',
      'bg-cyan-400': '#22D3EE',
      'bg-cyan-300': '#67E8F9',
      'bg-cyan-200': '#A7F3D0',
    };
    return colorMap[tailwindClass] || '#6B7280'; // Default gray si no encuentra el color
  };

  // Función para cambiar el color de un track
  const changeTrackColor = async (trackKey: string, color: string) => {
    const newColors = {
      ...trackColors,
      [trackKey]: color
    };
    
    setTrackColors(newColors);
    setShowColorPicker(null);
    
    // Guardar en Firestore si hay una canción seleccionada
    if (selectedSong && user) {
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        const songRef = doc(db, 'songs', selectedSong.id!);
        await updateDoc(songRef, {
          trackColors: newColors
        });
        
        console.log('✅ Colores de tracks guardados en Firestore');
      } catch (error) {
        console.error('❌ Error guardando colores en Firestore:', error);
      }
    }
  };

  // Función para toggle mute de track individual
  const toggleTrackMute = (trackKey: string) => {
    // Si está en solo, desactivar solo y activar mute
    if (trackSoloStates[trackKey]) {
      setTrackSoloStates(prev => ({
        ...prev,
        [trackKey]: false
      }));
      setTrackMutedStates(prev => ({
        ...prev,
        [trackKey]: true
      }));
      
      // Aplicar mute
      if (audioElements[trackKey]) {
        audioElements[trackKey].muted = true;
        audioElements[trackKey].volume = 0;
      }
      
      // Restaurar otros tracks si no hay más en solo
      const hasOtherSolo = Object.entries(trackSoloStates).some(([key, solo]) => key !== trackKey && solo);
      if (!hasOtherSolo) {
        Object.entries(audioElements).forEach(([key, audio]) => {
          if (key !== trackKey) {
            audio.muted = trackMutedStates[key] || false;
            audio.volume = volume;
          }
        });
      }
      return;
    }
    
    const newMutedState = !trackMutedStates[trackKey];
    setTrackMutedStates(prev => ({
      ...prev,
      [trackKey]: newMutedState
    }));
    
    // Aplicar mute al elemento de audio específico SIN pausar
    if (audioElements[trackKey]) {
      audioElements[trackKey].muted = newMutedState;
      // Mantener el volumen original para evitar desincronización
      audioElements[trackKey].volume = newMutedState ? 0 : volume;
    }
  };

  // Función para toggle solo de track individual
  const toggleTrackSolo = (trackKey: string) => {
    // Si está en mute, desactivar mute y activar solo
    if (trackMutedStates[trackKey]) {
      setTrackMutedStates(prev => ({
        ...prev,
        [trackKey]: false
      }));
      setTrackSoloStates(prev => ({
        ...prev,
        [trackKey]: true
      }));
      
      // Aplicar solo
      const updatedSoloStates = { ...trackSoloStates, [trackKey]: true };
      Object.entries(audioElements).forEach(([key, audio]) => {
        if (updatedSoloStates[key]) {
          // Track en solo: reproducir
          audio.muted = false;
          audio.volume = volume;
        } else {
          // Track no en solo: silenciar
          audio.muted = true;
        }
      });
      return;
    }
    
    const newSoloState = !trackSoloStates[trackKey];
    setTrackSoloStates(prev => ({
      ...prev,
      [trackKey]: newSoloState
    }));
    
    // Obtener el nuevo estado de solo después del toggle
    const updatedSoloStates = { ...trackSoloStates, [trackKey]: newSoloState };
    
    // Verificar si hay algún track en modo solo
    const hasAnySolo = Object.values(updatedSoloStates).some(solo => solo);
    
    if (hasAnySolo) {
      // Si hay tracks en solo: solo reproducir los que están en solo
      Object.entries(audioElements).forEach(([key, audio]) => {
        if (updatedSoloStates[key]) {
          // Track en solo: reproducir
          audio.muted = false;
          audio.volume = volume;
        } else {
          // Track no en solo: silenciar
          audio.muted = true;
        }
      });
    } else {
      // Si no hay tracks en solo: restaurar estados de mute originales
      Object.entries(audioElements).forEach(([key, audio]) => {
        audio.muted = trackMutedStates[key] || false;
        audio.volume = volume;
      });
    }
  };

  // Cambiar posición de la barra
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = Number(e.target.value);
    
    Object.values(audioElements).forEach(audio => {
      audio.currentTime = seekTime;
    });
    
    setCurrentTime(seekTime);
  };

  // Detectar el primer ataque de audio (onset) en un AudioBuffer
  const detectOnset = (audioBuffer: AudioBuffer): number => {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Calcular RMS (energía) en ventanas de 100ms
    const windowSizeMs = 100;
    const windowSize = Math.floor((windowSizeMs / 1000) * sampleRate);
    const threshold = 0.01; // Umbral de energía para detectar inicio
    
    for (let i = 0; i < channelData.length; i += windowSize) {
      const end = Math.min(i + windowSize, channelData.length);
      let sum = 0;
      
      // Calcular RMS de esta ventana
      for (let j = i; j < end; j++) {
        sum += channelData[j] * channelData[j];
      }
      
      const rms = Math.sqrt(sum / (end - i));
      
      // Si la energía supera el umbral, este es el onset
      if (rms > threshold) {
        const timeSeconds = i / sampleRate;
        return Math.round(timeSeconds * 1000); // Retornar en ms
      }
    }
    
    return 0; // Si no se detecta, retornar 0
  };


  const loadAudioFiles = async (song: Song) => {
    if (!song.stems) return
    
    // Esperar a que el cache esté cargado
    if (!cacheLoaded) {
      console.log('Esperando a que el cache se cargue...')
      return
    }
    
    console.log('🎵 Cache cargado, iniciando carga de audio...')
    console.log('🎵 Cache actual:', Object.keys(waveformCache).length, 'entradas')

    // Cargar colores guardados de Firestore
    if (song.trackColors) {
      setTrackColors(song.trackColors);
      console.log('✅ Colores de tracks cargados desde Firestore:', song.trackColors);
    }

    // Resetear estado de reproducción al cargar nueva canción
    setIsPlaying(false);
    setCurrentTime(0);
    setTrackOnsets({});
    console.log('Estado de reproduccion reseteado para nueva cancion');

    setIsLoadingAudio(true)
    const newAudioElements: { [key: string]: HTMLAudioElement } = {}
    const newWaveforms: { [key: string]: number[] } = {}
    const newLoadingStates: { [key: string]: 'idle' | 'loading' | 'cached' | 'ready' } = {}

    try {
      console.log('🎵 Loading song tracks:', song.stems)
      for (const [trackKey, trackUrl] of Object.entries(song.stems)) {
        if (trackUrl) {
          console.log(`🎵 Loading audio for ${trackKey}: ${trackUrl}`)
          
          // Log especial para click track
          if (trackKey === 'click') {
            console.log('🥁 CLICK TRACK: Iniciando carga de audio...')
            console.log('🥁 CLICK TRACK: URL:', trackUrl)
            console.log('🥁 CLICK TRACK: Metadata:', song.clickMetadata)
          }
          
          // 1. PRIMERO: Buscar en cache localStorage
          if (waveformCache[trackUrl]) {
            console.log(`✅ CACHE HIT para ${trackKey}`)
            newLoadingStates[trackKey] = 'cached'
            newWaveforms[trackKey] = waveformCache[trackUrl]
            
            // Crear elemento audio desde cache
            const audio = new Audio(trackUrl)
            audio.crossOrigin = 'anonymous'
            audio.preload = 'auto'
            
            // Log especial para click track
            if (trackKey === 'click') {
              console.log('🥁 CLICK TRACK: Elemento audio creado desde cache')
              console.log('🥁 CLICK TRACK: Audio src:', audio.src)
            }
            
            // Event listener para cuando termine la canción
            audio.addEventListener('ended', () => {
              console.log(`🏁 ${trackKey} ended - stopping all tracks`)
              // Pausar todos los audios y volver al inicio
              Object.values(newAudioElements).forEach(audio => {
                audio.pause();
                audio.currentTime = 0;
              });
              setIsPlaying(false);
              setCurrentTime(0);
            })
            
            newAudioElements[trackKey] = audio
            
            // Detectar onset también para archivos en cache
            try {
              console.log(`[ONSET] Detectando onset para ${trackKey} (desde cache)...`)
              const response = await fetch(trackUrl)
              const arrayBuffer = await response.arrayBuffer()
              const tempContext = new AudioContext()
              const audioBuffer = await tempContext.decodeAudioData(arrayBuffer)
              tempContext.close()
              
              const onsetTimeMs = detectOnset(audioBuffer)
              console.log(`[ONSET] ${trackKey}: Primer ataque en ${onsetTimeMs}ms`)
              setTrackOnsets(prev => {
                const updated = { ...prev, [trackKey]: onsetTimeMs }
                console.log(`[ONSET] trackOnsets actualizado:`, updated)
                return updated
              })
            } catch (error) {
              console.error(`[ONSET] Error detectando onset para ${trackKey}:`, error)
            }
            
            continue
          }
          
          // 2. SEGUNDO: Si no está en cache, descargar de B2
          console.log(`❌ CACHE MISS para ${trackKey} - descargando de B2`)
          
          // Marcar como cargando desde B2
          newLoadingStates[trackKey] = 'loading'
          setTrackLoadingStates(prev => ({ ...prev, [trackKey]: 'loading' }))
          
          const audio = new Audio(trackUrl)
          audio.crossOrigin = 'anonymous'
          audio.preload = 'auto'
          
          // Log especial para click track
          if (trackKey === 'click') {
            console.log('🥁 CLICK TRACK: Elemento audio creado (nuevo)')
            console.log('🥁 CLICK TRACK: Audio src:', audio.src)
          }
          
          // Agregar logging para diagnóstico
          audio.addEventListener('loadedmetadata', () => {
            console.log(`🎵 ${trackKey} metadata loaded:`, {
              duration: audio.duration,
              readyState: audio.readyState,
              src: audio.src
            })
            
            // Log especial para click track
            if (trackKey === 'click') {
              console.log('🥁 CLICK TRACK: Metadata cargada exitosamente')
              console.log('🥁 CLICK TRACK: Duración:', audio.duration, 'segundos')
            }
          })
          
          audio.addEventListener('canplaythrough', () => {
            console.log(`✅ ${trackKey} can play through:`, {
              duration: audio.duration,
              readyState: audio.readyState
            })
            
            // Log especial para click track
            if (trackKey === 'click') {
              console.log('🥁 CLICK TRACK: Listo para reproducir')
              console.log('🥁 CLICK TRACK: ReadyState:', audio.readyState)
            }
          })
          
          // Event listener para cuando termine la canción
          audio.addEventListener('ended', () => {
            console.log(`🏁 ${trackKey} ended - stopping all tracks`)
            // Pausar todos los audios y volver al inicio
            Object.values(newAudioElements).forEach(audio => {
              audio.pause();
              audio.currentTime = 0;
            });
            setIsPlaying(false);
            setCurrentTime(0);
          })
          
          audio.addEventListener('error', (e) => {
            console.error(`❌ ${trackKey} audio error:`, e)
          })
          
          // Esperar a que el audio esté listo
          await new Promise((resolve, reject) => {
            const onCanPlay = () => {
              audio.removeEventListener('canplaythrough', onCanPlay)
              audio.removeEventListener('error', onError)
              console.log(`🎵 ${trackKey} audio ready to play`)
              resolve(true)
            }
            const onError = (e: any) => {
              audio.removeEventListener('canplaythrough', onCanPlay)
              audio.removeEventListener('error', onError)
              console.error(`❌ ${trackKey} audio failed to load:`, e)
              reject(e)
            }
            audio.addEventListener('canplaythrough', onCanPlay)
            audio.addEventListener('error', onError)
            audio.load()
          })
          
          newAudioElements[trackKey] = audio
          
          // Generar waveform real del audio
          try {
            console.log(`🎵 Generating waveform for ${trackKey}`)
            
            // Log especial para click track
            if (trackKey === 'click') {
              console.log('CLICK TRACK: Iniciando descarga del archivo...')
            }
            
            const response = await fetch(trackUrl)
            const arrayBuffer = await response.arrayBuffer()
            
            // Verificar si el archivo tiene contenido
            console.log(`${trackKey} file size: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`)
            
            if (trackKey === 'click') {
              console.log('CLICK TRACK: Archivo descargado, decodificando audio...')
            }
            
            const tempContext = new AudioContext()
            const audioBuffer = await tempContext.decodeAudioData(arrayBuffer)
            tempContext.close()
            
            if (trackKey === 'click') {
              console.log('CLICK TRACK: Audio decodificado, generando waveform...')
            }
            
            // Detectar onset (primer ataque de audio) de este track
            console.log(`[ONSET] Detectando onset para ${trackKey}...`)
            const onsetTimeMs = detectOnset(audioBuffer)
            console.log(`[ONSET] ${trackKey}: Primer ataque en ${onsetTimeMs}ms`)
            setTrackOnsets(prev => {
              const updated = { ...prev, [trackKey]: onsetTimeMs }
              console.log(`[ONSET] trackOnsets actualizado:`, updated)
              return updated
            })
            
            // Verificar el contenido del audio de forma eficiente
            const channelData = audioBuffer.getChannelData(0)
            
            // Calcular maxAmplitude de forma eficiente sin desbordamiento de pila
            let maxAmplitude = 0
            for (let i = 0; i < channelData.length; i++) {
              const abs = Math.abs(channelData[i])
              if (abs > maxAmplitude) {
                maxAmplitude = abs
              }
            }
            
            // Calcular rmsAmplitude de forma eficiente
            let sumSquares = 0
            for (let i = 0; i < channelData.length; i++) {
              sumSquares += channelData[i] * channelData[i]
            }
            const rmsAmplitude = Math.sqrt(sumSquares / channelData.length)
            
            console.log(`🎵 ${trackKey} audio analysis:`, {
              samples: channelData.length,
              maxAmplitude: maxAmplitude,
              rmsAmplitude: rmsAmplitude,
              duration: audioBuffer.duration,
              sampleRate: audioBuffer.sampleRate,
              hasAudio: maxAmplitude > 0.001
            })
            
            // Generar waveform profesional de alta precisión
            const waveformData = generateProfessionalWaveform(channelData, 800) // Más puntos para mayor precisión
            newWaveforms[trackKey] = waveformData
            
            if (trackKey === 'click') {
              console.log('CLICK TRACK: Waveform generado, guardando en cache...')
            }
            
            // 3. GUARDAR en cache persistente para próximas veces
            const newPersistentCache = { ...waveformCache, [trackUrl]: waveformData }
            setWaveformCache(newPersistentCache)
            localStorage.setItem('waveform-cache', JSON.stringify(newPersistentCache))
            console.log(`💾 GUARDADO en cache para ${trackKey}`)
            
            newLoadingStates[trackKey] = 'ready'
            console.log(`✅ Waveform generado para ${trackKey}: ${waveformData.length} puntos`)
            
            if (trackKey === 'click') {
              console.log('CLICK TRACK: COMPLETADO - Track listo para reproducir')
            }
          } catch (error) {
            console.error(`Error generating waveform for ${trackKey}:`, error)
            newLoadingStates[trackKey] = 'idle'
          }
          
          console.log(`Audio loaded successfully for ${trackKey}`)
        }
      }
      
      // Cache ya se actualizó durante el loop
      
      setAudioElements(newAudioElements)
      setWaveforms(newWaveforms)
      setTrackLoadingStates(newLoadingStates)
      
      // Asegurar que todos los audios estén pausados al finalizar la carga
      Object.values(newAudioElements).forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
      setIsPlaying(false);
      setCurrentTime(0);
      
      console.log('All audio files loaded:', Object.keys(newAudioElements))
      console.log('All waveforms generated:', Object.keys(newWaveforms))
      console.log('✅ Todos los audios pausados y reseteados al finalizar carga')
    } catch (error) {
      console.error('Error loading audio files:', error)
    } finally {
      setIsLoadingAudio(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-lg">Por favor, inicia sesión</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-teal-500 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-2xl">J</span>
          </div>
          <p className="text-white text-lg">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Left Sidebar */}
      <div className="w-64 bg-gray-900 flex flex-col">

        {/* Navigation */}
        <div className="flex-1 p-4">
          <nav className="space-y-2">
            <div className="bg-gray-800 px-3 py-2">
              <span className="text-white font-medium">Track Separation</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-800 cursor-pointer">
              <span className="text-white">AI Studio</span>
              <span className="bg-red-600 text-white text-xs px-2 py-1">New</span>
            </div>
            <div className="px-3 py-2 hover:bg-gray-800 cursor-pointer">
              <span className="text-white">Voice Studio</span>
            </div>
            <div className="px-3 py-2 hover:bg-gray-800 cursor-pointer">
              <span className="text-white">Mastering</span>
            </div>
            <div className="px-3 py-2 hover:bg-gray-800 cursor-pointer">
              <span className="text-white">Lyric Writer</span>
            </div>
            <div className="px-3 py-2 hover:bg-gray-800 cursor-pointer">
              <span className="text-white">Plugins</span>
            </div>
          </nav>

          {/* Setlists Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">SETLISTS</span>
              <button className="text-teal-400 text-sm hover:text-teal-300">
                + New setlist
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-800 cursor-pointer">
                <div className="w-8 h-8 bg-red-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">4</span>
                </div>
                <div>
                  <div className="text-white text-sm">Guitar Exercises</div>
                  <div className="text-white text-xs">Berklee Online</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-800 cursor-pointer">
                <div className="w-8 h-8 bg-gray-700 flex items-center justify-center">
                  <Music className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-white text-sm">Judith Collection</div>
                  <div className="text-white text-xs">Judith</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-white">Track Separation</h1>
            <div className="flex items-center space-x-4">
              {/* Connection Status Icons */}
              <ConnectionStatus />
              
              {/* Botón temporal para eliminar todos los click tracks */}
              <button
                onClick={async () => {
                  if (!confirm('¿Eliminar TODOS los click tracks existentes? Esto es necesario para probar la nueva generación automática.')) return;
                  
                  try {
                    const { updateDoc, doc, getDocs, collection } = await import('firebase/firestore');
                    const { db } = await import('@/lib/firebase');
                    
                    // Obtener todas las canciones
                    const songsRef = collection(db, 'songs');
                    const songsSnapshot = await getDocs(songsRef);
                    
                    let updated = 0;
                    for (const songDoc of songsSnapshot.docs) {
                      const songData = songDoc.data();
                      if (songData.stems && songData.stems.click) {
                        // Eliminar click del stems
                        const updatedStems = { ...songData.stems };
                        delete updatedStems.click;
                        
                        await updateDoc(doc(db, 'songs', songDoc.id), {
                          stems: updatedStems,
                          clickMetadata: null
                        });
                        
                        updated++;
                      }
                    }
                    
                    console.log(`✅ ${updated} click tracks eliminados`);
                    alert(`✅ ${updated} click tracks eliminados. Recarga la página para ver los cambios.`);
                    
                  } catch (error) {
                    console.error('❌ Error eliminando click tracks:', error);
                    alert('❌ Error eliminando click tracks');
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                title="Eliminar todos los click tracks (temporal)"
              >
                🗑️ Limpiar Clicks
              </button>
              
            <button
              onClick={() => router.push('/moises-features')}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 flex items-center space-x-2"
            >
              <Zap className="w-4 h-4" />
              <span>Funcionalidades Moises</span>
            </button>
            
            <button
              onClick={() => router.push('/daw')}
              className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white px-4 py-2 flex items-center space-x-2"
            >
              <Music className="w-4 h-4" />
              <span>DAW Timeline</span>
            </button>
            
            <button
                onClick={() => setShowMoisesStyleModal(true)}
                className="px-4 py-2 hover:bg-gray-800 transition-colors duration-200"
                title="Subir Canción"
              >
                <img 
                  src="/images/subir.png" 
                  alt="Subir Canción"
                  className="w-[77px] h-[38px]"
                />
            </button>
              
              {/* User Profile in Header */}
              <div className="flex items-center space-x-3 border-l border-gray-600 pl-4">
                <div className="w-8 h-8 bg-gray-700 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-white text-sm font-medium">
                    {user.displayName || user.email?.split('@')[0] || 'Usuario'}
                  </div>
                  <div className="text-white text-xs">Free</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-white hover:text-white hover:bg-gray-800 transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center space-x-2 text-white">
                <span className="text-sm">Added</span>
                <ChevronDown className="w-4 h-4" />
              </div>
              </div>
            </div>

          {/* Tabs */}
          <div className="flex space-x-6">
            <button
              onClick={() => setActiveTab('my-songs')}
              className={`pb-2 border-b-2 ${
                activeTab === 'my-songs' 
                  ? 'border-teal-500 text-white' 
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              My songs
            </button>
            <button
              onClick={() => setActiveTab('shared')}
              className={`pb-2 border-b-2 ${
                activeTab === 'shared' 
                  ? 'border-teal-500 text-white' 
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Shared
            </button>
          </div>
          
          <div className="mt-2">
            <span className="text-gray-400 text-sm">{songs.length} songs</span>
          </div>
        </div>

        {/* Songs Table */}
        <div className="flex-1 p-6 bg-black">
          {(() => {
            console.log('Songs count:', songs.length, 'Loading:', songsLoading);
            return null;
          })()}
          {songsLoading ? (
            <div className="bg-gray-900 p-12 text-center">
              <div className="w-16 h-16 bg-gray-800 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Music className="w-8 h-8 text-white" />
              </div>
              <p className="text-white text-lg">Cargando canciones...</p>
            </div>
          ) : songs.length === 0 ? (
            <div className="bg-gray-900 p-12 text-center">
              <div className="w-16 h-16 bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <Music className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">No songs yet</h3>
              <p className="text-white mb-6">Upload your first audio file to get started with track separation</p>
              <div className="space-y-3">
              <button 
                onClick={handleUploadClick}
                className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 flex items-center space-x-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Upload Audio</span>
              </button>
                
                <button 
                  onClick={() => {
                    // Crear canción de prueba
                    const testSong = {
                      id: 'test-' + Date.now(),
                      title: 'Canción de Prueba',
                      artist: 'Artista Test',
                      genre: 'Test',
                      bpm: 120,
                      key: 'C',
                      duration: '3:45',
                      thumbnail: '♪',
                      fileUrl: 'http://example.com/test.mp3',
                      uploadedAt: new Date().toISOString(),
                      userId: user?.uid || 'test',
                      fileSize: 1000000,
                      fileName: 'test.mp3',
                      status: 'completed' as const
                    };
                    setSongs([testSong]);
                    console.log('Canción de prueba agregada');
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 flex items-center space-x-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Canción de Prueba</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-left py-3 px-4 text-white font-medium">Song</th>
                    <th className="text-left py-3 px-4 text-white font-medium">BPM</th>
                    <th className="text-left py-3 px-4 text-white font-medium">Key</th>
                    <th className="text-left py-3 px-4 text-white font-medium">Time Sig</th>
                    <th className="text-left py-3 px-4 text-white font-medium">Duration</th>
                    <th className="text-left py-3 px-4 text-white font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {songs.map((song) => {
                    console.log('Rendering song:', song.title, 'ID:', song.id);
                    return (
                    <tr key={song.id} data-song-id={song.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                      <td className="py-4 px-4">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            console.log('Opening modal for song:', song.title);
                            setSelectedSong(song);
                            setShowSongModal(true);
                            // Cargar audio después de un pequeño delay para asegurar que el modal esté abierto
                            setTimeout(() => loadAudioFiles(song), 100);
                          }}
                          className="w-full text-left hover:bg-gray-800 p-2 transition-colors"
                        >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-700 flex items-center justify-center">
                            <span className="text-white text-sm">{song.thumbnail}</span>
                          </div>
                            <div>
                              <div className="text-white text-sm">{song.title}</div>
                              <div className="text-white text-xs">{song.artist}</div>
                            </div>
                        </div>
                        </button>
                      </td>
                      <td className="py-4 px-4 text-white text-sm">{song.bpm || 'Calculando...'}</td>
                      <td className="py-4 px-4 text-white text-sm">{song.key || '-'}</td>
                      <td className="py-4 px-4 text-white text-sm">{song.timeSignature || '4/4'}</td>
                      <td className="py-4 px-4 text-white text-sm">{song.duration || 'Calculando...'}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          
                          {/* Botón temporal para eliminar click track */}
                          {song.stems?.click && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(`¿Eliminar click track de "${song.title}"?`)) return;
                                
                                try {
                                  const { updateDoc, doc } = await import('firebase/firestore');
                                  const { db } = await import('@/lib/firebase');
                                  
                                  // Eliminar click del stems
                                  const updatedStems = { ...song.stems };
                                  delete updatedStems.click;
                                  
                                  await updateDoc(doc(db, 'songs', song.id!), {
                                    stems: updatedStems,
                                    clickMetadata: null
                                  });
                                  
                                  console.log('✅ Click track eliminado de Firestore');
                                  alert('✅ Click track eliminado. Recarga la página para ver los cambios.');
                                  
                                } catch (error) {
                                  console.error('❌ Error eliminando click track:', error);
                                  alert('❌ Error eliminando click track');
                                }
                              }}
                              className="p-1 hover:bg-red-800 transition-colors duration-200 text-red-400"
                              title="Eliminar Click Track"
                            >
                              🗑️
                            </button>
                          )}
                          
                          {/* Botón para reproducir/detener click track */}
                          {song.stems?.click && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                
                                // Si ya está reproduciendo el click de esta canción, detenerlo
                                if (playingClickTrack && playingClickTrack.songId === song.id) {
                                  playingClickTrack.audio.pause();
                                  playingClickTrack.audio.currentTime = 0;
                                  setPlayingClickTrack(null);
                                  console.log('⏹️ Click track detenido');
                                } else {
                                  // Si hay otro click reproduciendo, detenerlo primero
                                  if (playingClickTrack) {
                                    playingClickTrack.audio.pause();
                                    playingClickTrack.audio.currentTime = 0;
                                  }
                                  
                                  // Reproducir el nuevo click
                                  const audio = new Audio(song.stems!.click);
                                  audio.play().catch(err => {
                                    console.error('Error reproduciendo click track:', err);
                                    alert('❌ Error al reproducir el click track');
                                    setPlayingClickTrack(null);
                                  });
                                  
                                  // Cuando termine, limpiar el estado
                                  audio.onended = () => {
                                    setPlayingClickTrack(null);
                                  };
                                  
                                  setPlayingClickTrack({ songId: song.id!, audio });
                                  
                                  // Mostrar info del click
                                  if (song.clickMetadata) {
                                    console.log('🎵 Reproduciendo click track:', song.clickMetadata);
                                  }
                                }
                              }}
                              className={`p-1 hover:bg-gray-800 transition-colors duration-200 ${
                                playingClickTrack && playingClickTrack.songId === song.id ? 'text-red-500' : 'text-green-500'
                              }`}
                              title={playingClickTrack && playingClickTrack.songId === song.id 
                                ? 'Detener Click Track' 
                                : `Reproducir Click Track (${song.clickMetadata?.bpm || song.bpm} BPM)`
                              }
                            >
                              {playingClickTrack && playingClickTrack.songId === song.id ? '⏹️' : '▶️'}
                            </button>
                          )}
                          
                          {song.stems && Object.keys(song.stems).length > 0 && (
                            <>
                            </>
                          )}
                          
                          {/* Botones de control de audio original */}
                          <div className="flex items-center space-x-1">
                            {/* Botón Play/Pause */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlayOriginalAudio(song);
                              }}
                              className="p-1 hover:bg-gray-800 transition-colors duration-200"
                              title={currentPlayingSong === song.id ? "Pausar audio original" : "Reproducir audio original"}
                            >
                              <img 
                                src={currentPlayingSong === song.id ? "/images/pausa.png" : "/images/play.png"} 
                                alt={currentPlayingSong === song.id ? "Pause" : "Play"}
                                className="w-10 h-10"
                              />
                            </button>
                            
                            {/* Botón Stop */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStopOriginalAudio(song);
                              }}
                              className="p-1 hover:bg-gray-800 transition-colors duration-200"
                              title="Detener audio original"
                            >
                              <img 
                                src="/images/stop.png" 
                                alt="Stop"
                                className="w-10 h-10"
                              />
                            </button>
                          </div>
                          
                        {/* Menú de 3 puntos */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDropdown(showDropdown === song.id ? null : song.id!);
                            }}
                            className="p-1 text-gray-400 hover:text-white transition-colors duration-200"
                            title="Más opciones"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          
                          {/* Dropdown menu */}
                          {showDropdown === song.id && (
                            <div className="absolute right-0 top-full mt-1 w-32 bg-gray-800 shadow-lg border border-gray-700 z-50">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowDropdown(null);
                                  handleDeleteSong(song.id!, song.title);
                                }}
                                className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors duration-200"
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-2">
          <Volume2 className="w-4 h-4 text-gray-400" />
        </div>
        <div className="text-gray-400 text-sm">
          {new Date().toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          })}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <NewSongUpload
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={handleUploadComplete}
          onOpenMixer={(songId) => {
            setShowUploadModal(false);
            // Buscar la canción por ID en la lista de canciones
            const song = songs.find(s => s.id === songId);
            if (song) {
              setSelectedSongForEditor(song);
              setShowAudioEditor(true);
            }
          }}
        />
      )}

      {/* Moises Style Modal */}
      {showMoisesStyleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black mx-auto flex flex-col border border-white border-opacity-20 relative max-w-5xl" style={{transform: 'scale(1.2)'}}>
                 {/* Botón de cerrar */}
                 <div className="absolute top-4 right-4 z-10">
                   <button
                     onClick={() => setShowMoisesStyleModal(false)}
                     className="text-white hover:text-gray-400 transition-colors bg-gray-800 hover:bg-gray-700 p-2"
                   >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                     </svg>
                   </button>
                 </div>

            {/* Contenido del Modal */}
            <div className="overflow-y-auto p-5">
              <div className="mx-auto space-y-5">
                {/* Upload Component */}
                <MoisesStyleUpload onUploadComplete={(songData) => {
                  console.log('🎵 Upload complete - Datos recibidos:', songData);
                  console.log('🎵 Stems disponibles:', songData.stems);
                  console.log('🎵 BPM detectado:', songData.bpm);
                  
                  // Cerrar el modal
                  setShowMoisesStyleModal(false);
                  
                  // Verificar que tenemos los datos necesarios
                  if (songData.stems && (songData.stems.vocals || songData.stems.instrumental)) {
                    console.log('✅ Separación completada, abriendo mixer automáticamente...');
                    console.log('🎵 Song ID:', songData.id);
                    console.log('🎵 Stems:', songData.stems);
                    
                    // Esperar un momento para que se actualice la lista de canciones
                    setTimeout(() => {
                      // Buscar el botón de la canción y hacer click automático
                      const songButton = document.querySelector(`[data-song-id="${songData.id}"] button`);
                      if (songButton) {
                        console.log('🎯 Haciendo click automático en el botón de la canción:', songData.id);
                        (songButton as HTMLElement).click();
                      } else {
                        console.log('⚠️ No se encontró el botón de la canción, recargando...');
                        window.location.reload();
                      }
                    }, 1000);
                  } else {
                    console.log('⚠️ No hay stems disponibles, recargando página');
                    window.location.reload();
                  }
                }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Song Modal */}
      {showSongModal && selectedSong && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 w-[90vw] h-[90vh] mx-4 flex flex-col border border-white border-opacity-20">
            {/* Header - 10% de la pantalla */}
            <div className="bg-black h-[10vh] flex items-center justify-between px-6">
              {/* Controles de audio en el lado izquierdo */}
              <div className="flex items-center">
                {/* Botón Play/Pause */}
                <button
                  onClick={togglePlayPause}
                  className="bg-black/40 backdrop-blur-md hover:bg-black/60 w-16 h-16 flex items-center justify-center transition-all duration-300 shadow-lg"
                >
                  <img 
                    src={isPlaying ? "/images/pausa.png" : "/images/play.png"} 
                    alt={isPlaying ? "Pause" : "Play"}
                    className="w-10 h-10"
                  />
                </button>
                
                {/* Botón Stop */}
                <button
                  onClick={() => {
                    Object.values(audioElements).forEach(audio => {
                      audio.pause();
                      audio.currentTime = 0;
                    });
                    setIsPlaying(false);
                    
                    // Metrónomo deshabilitado temporalmente
                    // stopMetronome();
                  }}
                  className="bg-black/40 backdrop-blur-md hover:bg-black/60 w-16 h-16 flex items-center justify-center transition-all duration-300 shadow-lg -ml-2"
                >
                  <img 
                    src="/images/stop.png" 
                    alt="Stop"
                    className="w-10 h-10"
                  />
                </button>
                
                {/* Controles de Metrónomo y Click Track */}
                <div className="flex flex-col gap-2 bg-black/20 backdrop-blur-md p-3 rounded-lg">
                  <span className="text-white text-xs font-bold text-center">Metrónomo & Click</span>
                  
                  {/* Botón de Mute/Unmute Metrónomo - OCULTO TEMPORALMENTE */}
                  <button
                    disabled
                    className="px-3 py-2 rounded text-gray-500 text-xs font-bold opacity-50 cursor-not-allowed"
                    title="Metrónomo deshabilitado temporalmente"
                  >
                    🥁 METRÓNOMO (OCULTO)
                  </button>
                  
                  {/* Botón de Renderizar Click Track */}
                  <button
                    onClick={renderClickTrack}
                    disabled={!selectedSong?.bpm || !selectedSong?.durationSeconds}
                    className={`px-3 py-2 rounded text-white text-xs font-bold transition-all duration-300 ${
                      selectedSong?.stems?.click
                        ? 'bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/50'
                        : 'bg-orange-500/20 hover:bg-orange-500/40 border border-orange-500/50'
                    } ${(!selectedSong?.bpm || !selectedSong?.durationSeconds) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={selectedSong?.stems?.click ? "Regenerar click track" : "Renderizar click track como stem"}
                  >
                    {selectedSong?.stems?.click ? '🔄 REGENERAR' : '🎵 RENDERIZAR CLICK'}
                  </button>
                  
                  {/* Información del primer golpe */}
                  {songFirstBeat > 0 && (
                    <div className="text-center">
                      <div className="text-yellow-400 text-[10px] font-mono">
                        Primer golpe: {songFirstBeat}ms
                      </div>
                      <div className="text-gray-400 text-[9px]">
                        BPM: {selectedSong?.bpm || 120}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Pantalla LED - Tiempo actual */}
                <div className="bg-black p-1 shadow-lg">
                  <div className="bg-green-900 text-green-400 font-mono text-sm font-bold tracking-wider px-1 py-0.5">
                    {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
                  </div>
                </div>
                
                {/* Espacio separador */}
                <div className="w-2"></div>
                
                {/* Barra de progreso */}
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-52 h-1 bg-gray-700 appearance-none cursor-pointer accent-teal-500"
                />
                
                {/* Espacio separador */}
                <div className="w-2"></div>
                
                {/* Pantalla LED - Duración total */}
                <div className="bg-black p-1 shadow-lg">
                  <div className="bg-red-900 text-red-400 font-mono text-sm font-bold tracking-wider px-1 py-0.5">
                    {duration ? `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}` : '0:00'}
                  </div>
                </div>
                
                {/* Espacio separador */}
                <div className="w-2"></div>
                
                {/* Control de volumen */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={toggleMute}
                    className="bg-black/40 backdrop-blur-md hover:bg-black/60 w-16 h-16 flex items-center justify-center transition-all duration-300 shadow-lg"
                  >
                    <img 
                      src={isMuted ? "/images/unmute.png" : "/images/mute.png"} 
                      alt={isMuted ? "Unmute" : "Mute"}
                      className="w-10 h-10"
                    />
                  </button>
                  
                  {/* Control de volumen master */}
                  <div className="flex items-center space-x-2">
                    <span className="text-white text-xs font-mono">Vol</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-20 h-1 bg-gray-600 appearance-none cursor-pointer accent-yellow-400"
                    />
                    <span className="text-white text-xs font-mono w-8">
                      {Math.round((isMuted ? 0 : volume) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
              
              {/* BPM Display LED */}
              {selectedSong.bpm && (
                <div className="flex items-center space-x-2">
                  <span className="text-white text-xs font-mono">BPM:</span>
                  <div className="bg-black p-1 shadow-lg">
                    <div className="bg-blue-900 text-blue-400 font-mono text-base font-bold tracking-wider px-3 py-1">
                      {selectedSong.bpm}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Botón de cerrar en el lado derecho */}
              <button
                onClick={() => {
                  // Limpiar elementos de audio
                  Object.values(audioElements).forEach(audio => {
                    audio.pause()
                    audio.src = ''
                  })
                  setAudioElements({})
                  setWaveforms({})
                  setTrackLoadingStates({})
                  setShowSongModal(false)
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Línea separadora */}
            <div className="h-[20px] bg-gray-950 w-full"></div>
            
            {/* Tracks Area - 60% */}
            <div className="h-[60vh] bg-gray-900 flex overflow-hidden">
              {/* Área fija de controles a la izquierda */}
              <div className="w-40 bg-gray-700 border-r border-gray-600 flex flex-col flex-shrink-0">
                {(() => {
                  const tracks = selectedSong.stems ? Object.entries(selectedSong.stems) : [];
                  
                  
                  return tracks.length > 0;
                })() ? (
                  (() => {
                    const tracks = selectedSong.stems ? Object.entries(selectedSong.stems) : [];
                    
                    
                    return tracks;
                  })().map(([trackKey, trackUrl], index) => {
                    // Colores grises escalados para cada track (fallback)
                    const grayColors = [
                      'bg-gray-700',  // Gris oscuro
                      'bg-gray-600',  // Gris medio-oscuro
                      'bg-gray-800',  // Gris muy oscuro
                      'bg-gray-500',  // Gris medio
                      'bg-gray-900',  // Gris casi negro
                      'bg-gray-700',  // Gris oscuro (repetir)
                    ];
                    const defaultColor = grayColors[index % grayColors.length];
                    const trackBackgroundColor = trackColors[trackKey] || defaultColor;
                    
                    const trackConfig = {
                      vocals: { color: 'bg-pink-500', letter: 'V', name: 'Vocals' },
                      instrumental: { color: 'bg-blue-500', letter: 'I', name: 'Instrumental' },
                      drums: { color: 'bg-orange-500', letter: 'D', name: 'Drums' },
                      bass: { color: 'bg-green-500', letter: 'B', name: 'Bass' },
                      other: { color: 'bg-purple-500', letter: 'O', name: 'Other' },
                      piano: { color: 'bg-yellow-500', letter: 'P', name: 'Piano' },
                      click: { color: 'bg-red-500', letter: 'C', name: 'Click Track' }
                    };
                    
                    const config = trackConfig[trackKey as keyof typeof trackConfig] || { 
                      color: 'bg-gray-500', 
                      letter: trackKey.charAt(0).toUpperCase(), 
                      name: trackKey 
                    };
                    
                    return (
                      <div key={trackKey} className="h-[12%] border-b border-gray-600 flex flex-col items-start justify-between p-2">
                        {/* Parte superior con nombre y color */}
                        <div className="flex items-start justify-between w-full">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-xs font-bold">{config.name}</span>
                              {/* Mostrar mensaje especial para track temporal de generación */}
                              {trackUrl === undefined && trackKey === 'click' ? (
                                <span className="text-blue-400 text-[10px] font-mono bg-blue-900/30 px-1 rounded animate-pulse">
                                  Generando Click...
                                </span>
                              ) : (
                                <>
                                  {(() => {
                                    const onsetValue = trackOnsets[trackKey];
                                    console.log(`[RENDER] ${trackKey} onset:`, onsetValue, 'trackOnsets:', trackOnsets);
                                    return onsetValue !== undefined && (
                                      <span className="text-yellow-400 text-[10px] font-mono bg-yellow-900/30 px-1 rounded">
                                        {onsetValue}ms
                                      </span>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                            {trackKey === 'click' && selectedSong.clickMetadata && (
                              <span className="text-gray-400 text-[10px] mt-0.5">
                                {selectedSong.clickMetadata.duration} • {selectedSong.clickMetadata.bpm} BPM • {selectedSong.clickMetadata.timeSignature}
                              </span>
                            )}
                          </div>
                          
                          {/* Botón selector de color - LED parpadeante */}
                          <button
                            onClick={() => setShowColorPicker(trackKey)}
                            className="w-4 h-2 rounded border border-gray-600 hover:border-white transition-all duration-300 animate-pulse shadow-lg"
                            style={{ 
                              backgroundColor: getColorFromClass(trackBackgroundColor),
                              boxShadow: `0 0 4px ${getColorFromClass(trackBackgroundColor)}, 0 0 8px ${getColorFromClass(trackBackgroundColor)}`
                            }}
                            title="Cambiar color del track"
                          />
                          
                          {/* Botón de debug temporal para click track */}
                          {trackKey === 'click' && trackUrl && (
                            <button
                              onClick={() => {
                                console.log('🔧 DEBUG: Probando reproducción de click track...')
                                console.log('🔧 DEBUG: URL:', trackUrl)
                                console.log('🔧 DEBUG: AudioElements:', audioElements)
                                console.log('🔧 DEBUG: Click audio element:', audioElements['click'])
                                
                                if (audioElements['click']) {
                                  const clickAudio = audioElements['click']
                                  console.log('🔧 DEBUG: Click audio src:', clickAudio.src)
                                  console.log('🔧 DEBUG: Click audio duration:', clickAudio.duration)
                                  console.log('🔧 DEBUG: Click audio readyState:', clickAudio.readyState)
                                  
                                  clickAudio.play().then(() => {
                                    console.log('🔧 DEBUG: Click track reproduciendo exitosamente')
                                  }).catch(err => {
                                    console.error('🔧 DEBUG: Error reproduciendo click track:', err)
                                  })
                                } else {
                                  console.log('🔧 DEBUG: No hay elemento de audio para click track')
                                }
                              }}
                              className="w-6 h-6 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded flex items-center justify-center ml-2"
                              title="Debug: Probar reproducción de click track"
                            >
                              🔧
                            </button>
                          )}
                        </div>
                        
                        {/* Botones M y S */}
                        <div className="flex space-x-1 self-end">
                          <button
                            onClick={() => toggleTrackMute(trackKey)}
                            className={`w-5 h-5 rounded flex items-center justify-center transition-colors text-xs font-bold ${
                              trackMutedStates[trackKey] 
                                ? 'bg-red-600 text-white' 
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            }`}
                            title={trackMutedStates[trackKey] ? "Unmute track" : "Mute track"}
                          >
                            M
                          </button>
                          
                          <button
                            onClick={() => toggleTrackSolo(trackKey)}
                            className={`w-5 h-5 rounded flex items-center justify-center transition-colors text-xs font-bold ${
                              trackSoloStates[trackKey] 
                                ? 'bg-yellow-600 text-white' 
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            }`}
                            title={trackSoloStates[trackKey] ? "Desactivar solo" : "Solo track"}
                          >
                            S
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : null}
              </div>
              
              {/* Área de tracks (sin controles) */}
              <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="h-full flex flex-col min-w-full">
                  {(() => {
                    const tracks = selectedSong.stems ? Object.entries(selectedSong.stems) : [];
                    
                    
                    return tracks.length > 0;
                  })() ? (
                  (() => {
                    const tracks = selectedSong.stems ? Object.entries(selectedSong.stems) : [];
                    
                    
                    return tracks;
                  })().map(([trackKey, trackUrl], index) => {
                    // Colores grises escalados para cada track (fallback)
                    const grayColors = [
                      'bg-gray-700',  // Gris oscuro
                      'bg-gray-600',  // Gris medio-oscuro
                      'bg-gray-800',  // Gris muy oscuro
                      'bg-gray-500',  // Gris medio
                      'bg-gray-900',  // Gris casi negro
                      'bg-gray-700',  // Gris oscuro (repetir)
                    ];
                    const defaultColor = grayColors[index % grayColors.length];
                    const trackBackgroundColor = trackColors[trackKey] || defaultColor;
                    
                    const trackConfig = {
                      vocals: { color: 'bg-pink-500', letter: 'V', name: 'Vocals' },
                      instrumental: { color: 'bg-blue-500', letter: 'I', name: 'Instrumental' },
                      drums: { color: 'bg-orange-500', letter: 'D', name: 'Drums' },
                      bass: { color: 'bg-green-500', letter: 'B', name: 'Bass' },
                      other: { color: 'bg-purple-500', letter: 'O', name: 'Other' },
                      piano: { color: 'bg-yellow-500', letter: 'P', name: 'Piano' },
                      click: { color: 'bg-red-500', letter: 'C', name: 'Click Track' }
                    };
                    
                    const config = trackConfig[trackKey as keyof typeof trackConfig] || { 
                      color: 'bg-gray-500', 
                      letter: trackKey.charAt(0).toUpperCase(), 
                      name: trackKey 
                    };
                    
                    return (
                      <div key={trackKey} className="h-[12%] w-full min-w-[800px]">
                        {/* Track independiente */}
                        <div className={`h-full ${trackBackgroundColor} border-b border-gray-700 min-w-0 relative overflow-visible`}>
                          {/* Waveform Container - Sin restricciones */}
                          <div className="w-full h-full relative flex items-center justify-center px-0 overflow-visible">
                            {/* Mostrar mensaje especial para track temporal de generación */}
                            {trackUrl === null && trackKey === 'click' ? (
                              <div className="flex items-center justify-center w-full h-full">
                                <div className="text-center">
                                  <div className="text-blue-400 text-sm font-bold animate-pulse">
                                    🥁 Generando Click Track...
                                  </div>
                                  <div className="text-gray-400 text-xs mt-1">
                                    Detectando onsets y calculando sincronización
                                  </div>
                                </div>
                              </div>
                            ) : waveforms[trackKey] && waveforms[trackKey].length > 0 ? (
                              <div className="w-full h-full relative flex items-center justify-center">
                                {waveformStyle === 'bars' && (
                                  // Waveform profesional estilo DAW
                                  <div className="flex items-center justify-center h-full w-full relative">
                                    <svg 
                                      width="100%" 
                                      height="100%" 
                                      viewBox="0 0 800 60"
                                      className="absolute inset-0"
                                      preserveAspectRatio="none"
                                    >
                                      <defs>
                                        <linearGradient id={`waveGradient-${trackKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                          <stop offset="0%" style={{stopColor: '#FFFFFF', stopOpacity: 0.9}} />
                                          <stop offset="100%" style={{stopColor: '#FFFFFF', stopOpacity: 0.9}} />
                                        </linearGradient>
                                      </defs>
                                      
                                      {/* Línea central */}
                                      <line x1="2" y1="30" x2="800" y2="30" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>
                                      
                                      {/* Waveform rellena profesional */}
                                      <path
                                        d={generateFilledWaveformPath(waveforms[trackKey])}
                                        fill={`url(#waveGradient-${trackKey})`}
                                        stroke="none"
                                      />
                                      
                                      {/* Contorno de la waveform */}
                                      <path
                                        d={waveforms[trackKey].map((value, index) => {
                                          const x = 2 + (index / (waveforms[trackKey].length - 1)) * 798;
                                          const y = 30 - (value * 25);
                                          return index === 0 ? `M ${x},${y}` : `L ${x},${y}`;
                                        }).join(' ')}
                                        fill="none"
                                        stroke="#FFFFFF"
                                        strokeWidth="1"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        opacity="0.8"
                                      />
                                      
                                      <path
                                        d={waveforms[trackKey].map((value, index) => {
                                          const x = 2 + (index / (waveforms[trackKey].length - 1)) * 798;
                                          const y = 30 + (value * 25);
                                          return index === 0 ? `M ${x},${y}` : `L ${x},${y}`;
                                        }).join(' ')}
                                        fill="none"
                                        stroke="#FFFFFF"
                                        strokeWidth="1"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        opacity="0.8"
                                      />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-gray-500 text-xs text-center">
                                {isLoadingAudio ? 'Loading...' : 
                                 audioElements[trackKey] ? 'Ready' : 
                                 trackUrl ? 'Available' : 'Not available'}
                              </div>
                            )}
                          </div>
                          
                          {/* Línea de reproducción profesional sincronizada */}
                          {audioElements[trackKey] && duration > 0 && (
                            <div className="absolute inset-0 pointer-events-none z-20">
                              {/* Línea de reproducción principal */}
                              <div 
                                className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 shadow-lg"
                                style={{ 
                                  left: `${Math.max(0, Math.min(100, (currentTime / Math.max(duration, 0.1)) * 100))}%`,
                                  boxShadow: '0 0 4px rgba(251, 191, 36, 0.8)'
                                }}
                              />
                              
                              {/* Indicador de posición en la waveform */}
                              <div 
                                className="absolute top-1/2 w-2 h-2 bg-yellow-400 rounded-full shadow-lg transform -translate-y-1/2 -translate-x-1/2"
                                style={{ 
                                  left: `${Math.max(0, Math.min(100, (currentTime / Math.max(duration, 0.1)) * 100))}%`,
                                  boxShadow: '0 0 6px rgba(251, 191, 36, 1)'
                                }}
                              />
                              
                              {/* Área ya reproducida */}
                              <div 
                                className="absolute inset-y-0 bg-gradient-to-r from-blue-500/20 to-transparent"
                                style={{ 
                                  width: `${Math.max(0, Math.min(100, (currentTime / Math.max(duration, 0.1)) * 100))}%`
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-gray-400 text-center">
                      <p>No stems available</p>
                      <p className="text-xs mt-2">This song hasn't been processed yet</p>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Mixer Area - 30% */}
            <div className="h-[30vh] bg-black pl-6 pr-[20px] pt-6 pb-6">
              <div className="h-full">
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de selección de colores */}
      {showColorPicker && (
        <div className="fixed inset-0 z-50">
          <div className="absolute left-[160px] top-20 bg-gray-800 rounded-lg p-2 w-48 border border-gray-600 shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white text-sm font-bold">Colores</h3>
              <button
                onClick={() => setShowColorPicker(null)}
                className="text-gray-400 hover:text-white text-lg"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {/* Columna Amarillo */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#FFFF00]')}
                  className="w-10 h-10 bg-[#FFFF00] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Amarillo puro"
                />
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#FFD700]')}
                  className="w-10 h-8 bg-[#FFD700] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Amarillo dorado"
                />
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#FFA500]')}
                  className="w-10 h-8 bg-[#FFA500] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Amarillo naranja"
                />
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#FF8C00]')}
                  className="w-10 h-8 bg-[#FF8C00] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Amarillo oscuro"
                />
              </div>
              
              {/* Columna Azul */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#0000FF]')}
                  className="w-10 h-10 bg-[#0000FF] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Azul puro"
                />
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#0080FF]')}
                  className="w-10 h-8 bg-[#0080FF] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Azul claro"
                />
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#0066CC]')}
                  className="w-10 h-8 bg-[#0066CC] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Azul medio"
                />
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#003399]')}
                  className="w-10 h-8 bg-[#003399] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Azul oscuro"
                />
              </div>
              
              {/* Columna Rojo */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#FF0000]')}
                  className="w-10 h-10 bg-[#FF0000] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Rojo puro"
                />
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#FF6666]')}
                  className="w-10 h-8 bg-[#FF6666] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Rojo claro"
                />
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#CC0000]')}
                  className="w-10 h-8 bg-[#CC0000] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Rojo medio"
                />
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#800000]')}
                  className="w-10 h-8 bg-[#800000] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Rojo oscuro"
                />
              </div>
              
              {/* Columna Negro/Grises */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-black')}
                  className="w-10 h-10 bg-black rounded border border-gray-600 hover:border-white transition-colors"
                  title="Negro"
                />
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#333333]')}
                  className="w-10 h-8 bg-[#333333] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Gris muy oscuro"
                />
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#666666]')}
                  className="w-10 h-8 bg-[#666666] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Gris medio"
                />
                <button
                  onClick={() => changeTrackColor(showColorPicker, 'bg-[#999999]')}
                  className="w-10 h-8 bg-[#999999] rounded border border-gray-600 hover:border-white transition-colors"
                  title="Gris claro"
                />
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}