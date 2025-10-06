/**
 * AudioAnalyzer - Análisis avanzado de audio y visualización
 * Basado en las funcionalidades de Moises.ai
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart3, Activity, Zap, Volume2, Music, TrendingUp } from 'lucide-react';

interface AudioAnalyzerProps {
  audioUrl?: string;
  onClose?: () => void;
}

interface AudioData {
  waveform: number[];
  spectrum: number[];
  frequency: number[];
  amplitude: number[];
  rms: number;
  peak: number;
  dynamicRange: number;
  spectralCentroid: number;
  spectralRolloff: number;
  zeroCrossingRate: number;
}

const AudioAnalyzer: React.FC<AudioAnalyzerProps> = ({ audioUrl, onClose }) => {
  const [audioData, setAudioData] = useState<AudioData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [selectedView, setSelectedView] = useState<'waveform' | 'spectrum' | 'frequency'>('waveform');
  const [isRealTime, setIsRealTime] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Simular análisis de audio (en producción sería una llamada al backend)
  const analyzeAudio = async () => {
    if (!audioUrl) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    // Simular progreso de análisis
    for (let i = 0; i <= 100; i += 10) {
      setAnalysisProgress(i);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Datos simulados
    const mockData: AudioData = {
      waveform: Array.from({ length: 1000 }, () => Math.random() * 2 - 1),
      spectrum: Array.from({ length: 256 }, () => Math.random() * 100),
      frequency: Array.from({ length: 256 }, (_, i) => i * 86.13), // Hz
      amplitude: Array.from({ length: 1000 }, () => Math.random() * 0.8),
      rms: 0.45,
      peak: 0.89,
      dynamicRange: 24.5,
      spectralCentroid: 1200,
      spectralRolloff: 8000,
      zeroCrossingRate: 0.12
    };

    setAudioData(mockData);
    setIsAnalyzing(false);
  };

  const startRealTimeAnalysis = () => {
    if (!audioUrl || !audioRef.current) return;

    try {
      // Crear AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      
      const source = audioContext.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      
      analyserRef.current = analyser;
      setIsRealTime(true);
      
      // Iniciar visualización en tiempo real
      animate();
    } catch (error) {
      console.error('Error starting real-time analysis:', error);
    }
  };

  const stopRealTimeAnalysis = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsRealTime(false);
  };

  const animate = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Limpiar canvas
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Dibujar según la vista seleccionada
      switch (selectedView) {
        case 'spectrum':
          drawSpectrum(ctx, dataArray, canvas.width, canvas.height);
          break;
        case 'frequency':
          drawFrequency(ctx, dataArray, canvas.width, canvas.height);
          break;
        default:
          drawWaveform(ctx, dataArray, canvas.width, canvas.height);
      }
      
      animationRef.current = requestAnimationFrame(draw);
    };
    
    draw();
  }, [selectedView]);

  const drawWaveform = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number) => {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const sliceWidth = width / data.length;
    let x = 0;
    
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 255.0;
      const y = v * height;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.stroke();
  };

  const drawSpectrum = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number) => {
    const barWidth = width / data.length;
    
    for (let i = 0; i < data.length; i++) {
      const barHeight = (data[i] / 255) * height;
      const x = i * barWidth;
      const y = height - barHeight;
      
      // Color basado en frecuencia
      const hue = (i / data.length) * 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  };

  const drawFrequency = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number) => {
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const sliceWidth = width / data.length;
    let x = 0;
    
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 255.0;
      const y = height - (v * height);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.stroke();
  };

  const formatValue = (value: number, unit: string = '') => {
    if (unit === 'Hz') {
      return value >= 1000 ? `${(value / 1000).toFixed(1)}k${unit}` : `${value.toFixed(0)}${unit}`;
    }
    return `${value.toFixed(2)}${unit}`;
  };

  const getQualityColor = (value: number, thresholds: [number, number, number]) => {
    if (value < thresholds[0]) return 'text-red-400';
    if (value < thresholds[1]) return 'text-yellow-400';
    return 'text-green-400';
  };

  const AudioMetrics = () => {
    if (!audioData) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Volume2 className="h-4 w-4 text-blue-400" />
            <span className="text-gray-300 text-sm">RMS</span>
          </div>
          <div className={`text-2xl font-bold ${getQualityColor(audioData.rms, [0.1, 0.3, 0.5])}`}>
            {audioData.rms.toFixed(3)}
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="text-gray-300 text-sm">Peak</span>
          </div>
          <div className={`text-2xl font-bold ${getQualityColor(audioData.peak, [0.5, 0.7, 0.9])}`}>
            {audioData.peak.toFixed(3)}
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <span className="text-gray-300 text-sm">Dynamic Range</span>
          </div>
          <div className={`text-2xl font-bold ${getQualityColor(audioData.dynamicRange, [10, 20, 30])}`}>
            {audioData.dynamicRange.toFixed(1)}dB
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="h-4 w-4 text-purple-400" />
            <span className="text-gray-300 text-sm">Spectral Centroid</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {formatValue(audioData.spectralCentroid, 'Hz')}
          </div>
        </div>
      </div>
    );
  };

  const VisualizationControls = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Visualización</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setSelectedView('waveform')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              selectedView === 'waveform'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            Waveform
          </button>
          <button
            onClick={() => setSelectedView('spectrum')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              selectedView === 'spectrum'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            Espectro
          </button>
          <button
            onClick={() => setSelectedView('frequency')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              selectedView === 'frequency'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            Frecuencia
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <canvas
          ref={canvasRef}
          width={800}
          height={300}
          className="w-full h-48 bg-gray-900 rounded"
        />
      </div>
    </div>
  );

  return (
    <div className="bg-dark-800 rounded-lg p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <BarChart3 className="h-6 w-6 mr-2" />
          Análisis de Audio
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

      {/* Audio Player */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        />
      )}

      {/* Analysis Progress */}
      {isAnalyzing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-300">
            <span>Analizando audio...</span>
            <span>{analysisProgress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-primary-500 to-primary-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${analysisProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Analysis Button */}
      {!isAnalyzing && !audioData && (
        <div className="text-center py-8">
          <button
            onClick={analyzeAudio}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center mx-auto"
          >
            <BarChart3 className="h-5 w-5 mr-2" />
            Analizar Audio
          </button>
        </div>
      )}

      {/* Real-time Controls */}
      {audioData && (
        <div className="flex justify-center space-x-4">
          <button
            onClick={isRealTime ? stopRealTimeAnalysis : startRealTimeAnalysis}
            className={`${
              isRealTime 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'
            } text-white px-6 py-3 rounded-lg flex items-center font-medium`}
          >
            <Activity className="h-4 w-4 mr-2" />
            {isRealTime ? 'Detener Tiempo Real' : 'Análisis en Tiempo Real'}
          </button>
        </div>
      )}

      {/* Audio Metrics */}
      {audioData && <AudioMetrics />}

      {/* Visualization */}
      {audioData && <VisualizationControls />}

      {/* Additional Analysis */}
      {audioData && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Análisis Adicional</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">Características Espectrales</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Spectral Rolloff:</span>
                  <span className="text-white">{formatValue(audioData.spectralRolloff, 'Hz')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Zero Crossing Rate:</span>
                  <span className="text-white">{audioData.zeroCrossingRate.toFixed(3)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">Calidad de Audio</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Rango Dinámico:</span>
                  <span className={`${getQualityColor(audioData.dynamicRange, [10, 20, 30])}`}>
                    {audioData.dynamicRange.toFixed(1)}dB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Nivel RMS:</span>
                  <span className={`${getQualityColor(audioData.rms, [0.1, 0.3, 0.5])}`}>
                    {audioData.rms.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-gray-400 space-y-1">
        <div>📊 <strong>Tip:</strong> El análisis en tiempo real muestra la actividad espectral actual</div>
        <div>🎵 Los colores del espectro representan diferentes rangos de frecuencia</div>
      </div>
    </div>
  );
};

export default AudioAnalyzer;

