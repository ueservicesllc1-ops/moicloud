/**
 * TempoPitchController - Controlador de tempo y tono
 * Basado en las funcionalidades de Moises.ai
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, Music, Zap } from 'lucide-react';

interface TempoPitchControllerProps {
  audioUrl?: string;
  onClose?: () => void;
  onTempoChange?: (tempo: number) => void;
  onPitchChange?: (pitch: number) => void;
}

const TempoPitchController: React.FC<TempoPitchControllerProps> = ({
  audioUrl,
  onClose,
  onTempoChange,
  onPitchChange
}) => {
  const [tempo, setTempo] = useState(120);
  const [pitch, setPitch] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [originalTempo, setOriginalTempo] = useState(120);
  const [isProcessing, setIsProcessing] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Presets de tempo
  const tempoPresets = [
    { name: 'Muy Lento', value: 60, color: 'bg-blue-500' },
    { name: 'Lento', value: 80, color: 'bg-blue-600' },
    { name: 'Normal', value: 120, color: 'bg-green-500' },
    { name: 'Rápido', value: 140, color: 'bg-orange-500' },
    { name: 'Muy Rápido', value: 180, color: 'bg-red-500' }
  ];

  // Presets de pitch
  const pitchPresets = [
    { name: '2 octavas abajo', value: -24, color: 'bg-purple-500' },
    { name: '1 octava abajo', value: -12, color: 'bg-purple-600' },
    { name: '5 semitonos abajo', value: -5, color: 'bg-blue-500' },
    { name: 'Original', value: 0, color: 'bg-green-500' },
    { name: '5 semitonos arriba', value: 5, color: 'bg-orange-500' },
    { name: '1 octava arriba', value: 12, color: 'bg-red-500' },
    { name: '2 octavas arriba', value: 24, color: 'bg-red-600' }
  ];

  const handleTempoChange = (newTempo: number) => {
    setTempo(newTempo);
    onTempoChange?.(newTempo);
  };

  const handlePitchChange = (newPitch: number) => {
    setPitch(newPitch);
    onPitchChange?.(newPitch);
  };

  const resetToOriginal = () => {
    setTempo(originalTempo);
    setPitch(0);
    onTempoChange?.(originalTempo);
    onPitchChange?.(0);
  };

  const applyChanges = async () => {
    setIsProcessing(true);
    
    // Simular procesamiento (en producción sería una llamada al backend)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsProcessing(false);
  };

  const formatTempo = (tempo: number) => {
    return `${tempo} BPM`;
  };

  const formatPitch = (pitch: number) => {
    if (pitch === 0) return 'Original';
    if (pitch > 0) return `+${pitch} semitonos`;
    return `${pitch} semitonos`;
  };

  const getTempoColor = (currentTempo: number) => {
    if (currentTempo < 80) return 'text-blue-400';
    if (currentTempo < 120) return 'text-green-400';
    if (currentTempo < 160) return 'text-orange-400';
    return 'text-red-400';
  };

  const getPitchColor = (currentPitch: number) => {
    if (currentPitch < -12) return 'text-purple-400';
    if (currentPitch < 0) return 'text-blue-400';
    if (currentPitch === 0) return 'text-green-400';
    if (currentPitch < 12) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-dark-800 rounded-lg p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Zap className="h-6 w-6 mr-2" />
          Control de Tempo y Tono
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        )}
      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="bg-yellow-600 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span className="text-white font-medium">Procesando cambios...</span>
          </div>
        </div>
      )}

      {/* Tempo Control */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Music className="h-5 w-5 mr-2" />
          Control de Tempo
        </h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Tempo actual:</span>
            <span className={`font-bold text-lg ${getTempoColor(tempo)}`}>
              {formatTempo(tempo)}
            </span>
          </div>
          
          <input
            type="range"
            min="60"
            max="200"
            value={tempo}
            onChange={(e) => handleTempoChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((tempo - 60) / 140) * 100}%, #374151 ${((tempo - 60) / 140) * 100}%, #374151 100%)`
            }}
          />
          
          <div className="flex justify-between text-xs text-gray-400">
            <span>60 BPM</span>
            <span>200 BPM</span>
          </div>
        </div>

        {/* Tempo Presets */}
        <div className="space-y-2">
          <span className="text-sm text-gray-400">Presets de tempo:</span>
          <div className="grid grid-cols-3 gap-2">
            {tempoPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleTempoChange(preset.value)}
                className={`p-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  tempo === preset.value
                    ? `${preset.color} text-white shadow-lg`
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pitch Control */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Volume2 className="h-5 w-5 mr-2" />
          Control de Tono
        </h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Tono actual:</span>
            <span className={`font-bold text-lg ${getPitchColor(pitch)}`}>
              {formatPitch(pitch)}
            </span>
          </div>
          
          <input
            type="range"
            min="-24"
            max="24"
            value={pitch}
            onChange={(e) => handlePitchChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((pitch + 24) / 48) * 100}%, #374151 ${((pitch + 24) / 48) * 100}%, #374151 100%)`
            }}
          />
          
          <div className="flex justify-between text-xs text-gray-400">
            <span>-24 semitonos</span>
            <span>+24 semitonos</span>
          </div>
        </div>

        {/* Pitch Presets */}
        <div className="space-y-2">
          <span className="text-sm text-gray-400">Presets de tono:</span>
          <div className="grid grid-cols-2 gap-2">
            {pitchPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePitchChange(preset.value)}
                className={`p-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  pitch === preset.value
                    ? `${preset.color} text-white shadow-lg`
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current Settings Summary */}
      <div className="bg-gray-700 rounded-lg p-4 space-y-2">
        <h4 className="text-white font-semibold">Configuración Actual</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Tempo:</span>
            <span className="text-white ml-2 font-medium">{formatTempo(tempo)}</span>
          </div>
          <div>
            <span className="text-gray-400">Tono:</span>
            <span className="text-white ml-2 font-medium">{formatPitch(pitch)}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center font-medium"
        >
          {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          {isPlaying ? 'Pausar' : 'Reproducir'}
        </button>
        
        <button
          onClick={resetToOriginal}
          className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg flex items-center font-medium"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Restablecer
        </button>
        
        <button
          onClick={applyChanges}
          disabled={isProcessing}
          className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-500 text-white px-6 py-3 rounded-lg flex items-center font-medium"
        >
          <Zap className="h-4 w-4 mr-2" />
          Aplicar Cambios
        </button>
      </div>

      {/* Info */}
      <div className="text-xs text-gray-400 space-y-1">
        <div>💡 <strong>Tip:</strong> El cambio de tempo no afecta el tono y viceversa</div>
        <div>🎵 Los cambios se aplican en tiempo real para una experiencia fluida</div>
      </div>
    </div>
  );
};

export default TempoPitchController;

