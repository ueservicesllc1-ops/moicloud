/**
 * EnhancedWaveSurfer - Componente mejorado de WaveSurfer con efectos visuales avanzados
 * Proporciona ondas más realistas y efectos visuales profesionales
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import './WaveSurferStyles.css';

interface EnhancedWaveSurferProps {
  src: string;
  title: string;
  color?: string;
  height?: number;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onVolumeChange?: (volume: number) => void;
  volume?: number;
  className?: string;
}

const EnhancedWaveSurfer: React.FC<EnhancedWaveSurferProps> = ({
  src,
  title,
  color = '#3b82f6',
  height = 80,
  isPlaying = false,
  onPlay,
  onPause,
  onVolumeChange,
  volume = 1,
  className = ''
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);

  // Cargar WaveSurfer.js con configuraciones avanzadas
  useEffect(() => {
    const loadWaveSurfer = async () => {
      try {
        const WaveSurfer = (await import('wavesurfer.js')).default;
        
        if (waveformRef.current && src) {
          // Configuración avanzada para ondas más realistas
          wavesurferRef.current = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: color,
            progressColor: color,
            cursorColor: '#ffffff',
            barWidth: 1,
            barGap: 0.3,
            barRadius: 3,
            height: height,
            normalize: true,
            backend: 'WebAudio',
            mediaControls: false,
            interact: true,
            // Configuraciones avanzadas para realismo
            fillParent: true,
            minPxPerSec: 1,
            hideScrollbar: true,
            audioRate: 1,
            dragToSeek: true
          });

          // Event listeners avanzados
          wavesurferRef.current.on('ready', () => {
            setIsLoading(false);
            setIsReady(true);
            setDuration(wavesurferRef.current.getDuration());
            
            // Obtener datos de la forma de onda para efectos visuales
            const waveformData = wavesurferRef.current.getDecodedData();
            if (waveformData) {
              setWaveformData(waveformData.getChannelData(0));
            }
          });

          wavesurferRef.current.on('audioprocess', (time: number) => {
            setCurrentTime(time);
          });

          wavesurferRef.current.on('seek', (progress: number) => {
            const time = progress * duration;
            setCurrentTime(time);
          });

          wavesurferRef.current.on('play', () => {
            if (onPlay) onPlay();
          });

          wavesurferRef.current.on('pause', () => {
            if (onPause) onPause();
          });

          wavesurferRef.current.on('finish', () => {
            if (onPause) onPause();
          });

          // Cargar el archivo de audio
          wavesurferRef.current.load(src);
        }
      } catch (error) {
        console.error('Error loading enhanced WaveSurfer:', error);
        setIsLoading(false);
      }
    };

    loadWaveSurfer();

    // Cleanup
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [src, color, height, onPlay, onPause]);

  // Controlar reproducción
  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      if (isPlaying) {
        wavesurferRef.current.play();
      } else {
        wavesurferRef.current.pause();
      }
    }
  }, [isPlaying, isReady]);

  // Controlar volumen
  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted, isReady]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      if (onPause) onPause();
    } else {
      if (onPlay) onPlay();
    }
  }, [isPlaying, onPlay, onPause]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (wavesurferRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const progress = x / rect.width;
      wavesurferRef.current.seekTo(progress);
    }
  }, [duration]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (onVolumeChange) {
      onVolumeChange(newVolume);
    }
    setIsMuted(newVolume === 0);
  }, [onVolumeChange]);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`enhanced-wavesurfer-container ${className}`}>
      {/* Información de la pista */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div 
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: color }}
          ></div>
          <span className="text-white font-medium text-sm">{title}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePlayPause}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
            disabled={!isReady}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          
          <button
            onClick={toggleMute}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Contenedor de la forma de onda con efectos visuales */}
      <div className="relative">
        <div 
          ref={waveformRef}
          className={`wavesurfer-container ${isPlaying ? 'playing' : ''} ${isReady ? 'active' : ''}`}
          onClick={handleSeek}
          style={{ 
            minHeight: `${height}px`,
            background: `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`
          }}
        />
        
        {/* Efectos visuales adicionales */}
        {isPlaying && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="waveform-glow-effect" style={{ backgroundColor: color }} />
          </div>
        )}
        
        {/* Indicador de tiempo */}
        <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-black bg-opacity-50 px-2 py-1 rounded">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Control de volumen */}
      <div className="mt-3 flex items-center space-x-2">
        <Volume2 className="w-4 h-4 text-gray-400" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
        />
        <span className="text-gray-400 text-xs w-8">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </span>
      </div>

      {/* Efectos de partículas para ondas dinámicas */}
      {isPlaying && waveformData && (
        <div className="particle-effect">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${(i / 20) * 100}%`,
                animationDelay: `${i * 0.1}s`,
                backgroundColor: color
              }}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        .enhanced-wavesurfer-container {
          position: relative;
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .waveform-glow-effect {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          opacity: 0.1;
          border-radius: 6px;
          animation: pulse 2s ease-in-out infinite;
        }

        .particle-effect {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          overflow: hidden;
          border-radius: 6px;
        }

        .particle {
          position: absolute;
          width: 2px;
          height: 2px;
          border-radius: 50%;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0; }
          50% { transform: translateY(-20px) scale(1.5); opacity: 0.6; }
        }

        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 4px rgba(59, 130, 246, 0.4);
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 4px rgba(59, 130, 246, 0.4);
        }
      `}</style>
    </div>
  );
};

export default EnhancedWaveSurfer;
