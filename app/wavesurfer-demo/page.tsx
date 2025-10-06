'use client'

import { useState, useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, Music, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function WaveSurferDemo() {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);

  // URL de audio de ejemplo (puedes cambiar por una URL real)
  const audioUrl = 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav';

  useEffect(() => {
    if (containerRef.current && !waveSurferRef.current) {
      // Crear instancia de WaveSurfer
      waveSurferRef.current = WaveSurfer.create({
        container: containerRef.current,
        waveColor: '#4f46e5',
        progressColor: '#7c3aed',
        cursorColor: '#ffffff',
        barWidth: 2,
        barRadius: 3,
        height: 100,
        normalize: true,
        backend: 'WebAudio',
        mediaControls: false
      });

      // Cargar audio
      waveSurferRef.current.load(audioUrl);

      // Event listeners
      waveSurferRef.current.on('ready', () => {
        console.log('🎵 WaveSurfer ready!');
        setDuration(waveSurferRef.current?.getDuration() || 0);
      });

      waveSurferRef.current.on('audioprocess', (time) => {
        setCurrentTime(time);
      });

      waveSurferRef.current.on('finish', () => {
        setIsPlaying(false);
      });

      waveSurferRef.current.on('play', () => {
        setIsPlaying(true);
      });

      waveSurferRef.current.on('pause', () => {
        setIsPlaying(false);
      });
    }

    return () => {
      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
    };
  }, []);

  const togglePlay = () => {
    if (waveSurferRef.current) {
      if (isPlaying) {
        waveSurferRef.current.pause();
      } else {
        waveSurferRef.current.play();
      }
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (waveSurferRef.current) {
      waveSurferRef.current.setVolume(newVolume);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Botón de regreso al inicio */}
        <div className="flex justify-start mb-6">
          <button
            onClick={() => router.push('/')}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Inicio</span>
          </button>
        </div>
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">WaveSurfer.js Demo</h1>
          <p className="text-gray-400 text-lg">
            Visualización de ondas de audio con WaveSurfer.js
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <Music className="h-8 w-8 text-blue-400" />
            <div>
              <h2 className="text-xl font-semibold">Audio Player</h2>
              <p className="text-gray-400">Reproduce y visualiza ondas de audio</p>
            </div>
          </div>

          {/* Waveform Container */}
          <div 
            ref={containerRef}
            className="w-full bg-gray-700 rounded-lg p-4 mb-6"
            style={{ minHeight: '120px' }}
          ></div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={togglePlay}
                className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full transition-colors"
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>
              
              <div className="flex items-center space-x-2">
                <Volume2 className="h-5 w-5 text-gray-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-24 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                />
                <span className="text-sm text-gray-400 w-8">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>

            <div className="text-sm text-gray-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-blue-400">Características</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Visualización de ondas en tiempo real</li>
              <li>• Control de reproducción y pausa</li>
              <li>• Control de volumen</li>
              <li>• Barra de progreso interactiva</li>
              <li>• Responsive design</li>
            </ul>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-green-400">Tecnologías</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• WaveSurfer.js v7.7.3</li>
              <li>• Web Audio API</li>
              <li>• React + TypeScript</li>
              <li>• Tailwind CSS</li>
              <li>• Lucide React Icons</li>
            </ul>
          </div>
        </div>

        {/* Code Example */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <h3 className="text-xl font-semibold mb-4 text-purple-400">Código de Ejemplo</h3>
          <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
            <code className="text-green-400">
{`import WaveSurfer from 'wavesurfer.js';

const waveSurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#4f46e5',
  progressColor: '#7c3aed',
  cursorColor: '#ffffff',
  barWidth: 2,
  barRadius: 3,
  responsive: true,
  height: 100,
  normalize: true
});

waveSurfer.load('audio-file.mp3');`}
            </code>
          </pre>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}