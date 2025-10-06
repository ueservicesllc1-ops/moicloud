/**
 * Página de prueba para todas las funcionalidades de Moises
 */

'use client';

import React, { useState, useRef } from 'react';
import { Music, Upload, Play, Pause, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import MoisesFeatures from '@/components/MoisesFeatures';
import ChordAnalyzer from '@/components/ChordAnalyzer';
import TempoPitchController from '@/components/TempoPitchController';
import LoopSections from '@/components/LoopSections';
import AudioAnalyzer from '@/components/AudioAnalyzer';
import MoisesStyleInterface from '@/components/MoisesStyleInterface';

export default function MoisesFeaturesPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(180);
  const [showMoisesInterface, setShowMoisesInterface] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      
      // Simular duración
      setDuration(Math.floor(Math.random() * 300) + 60);
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold flex items-center">
            <Music className="h-8 w-8 mr-3" />
            Moises Clone - Funcionalidades Completas
          </h1>
          <p className="text-primary-200 mt-2 text-lg">
            Prueba todas las funcionalidades implementadas: Análisis de acordes, Control de tempo/tono, 
            Loop sections y Análisis de audio
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Botón de regreso al inicio */}
        <div className="flex justify-start mb-4">
          <button
            onClick={() => router.push('/')}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Inicio</span>
          </button>
        </div>
        
        {/* File Upload Section */}
        <div className="bg-dark-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <Upload className="h-6 w-6 mr-2" />
            Cargar Archivo de Audio
          </h2>
          
          <div className="space-y-4">
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none"
            />
            
            {selectedFile && (
              <div className="bg-green-900 bg-opacity-30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-400 font-medium">✅ Archivo cargado: {selectedFile.name}</p>
                    <p className="text-green-300 text-sm">
                      Tamaño: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={handlePlayPause}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center"
                  >
                    {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {isPlaying ? 'Pausar' : 'Reproducir'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Audio Player */}
        {audioUrl && (
          <div className="bg-dark-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Reproductor de Audio</h3>
            <audio
              ref={audioRef}
              controls
              src={audioUrl}
              className="w-full"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
          </div>
        )}

        {/* Moises Style Interface Button */}
        {audioUrl && (
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-6 text-center">
            <h3 className="text-xl font-bold text-white mb-4">🎸 Interfaz Estilo Moises</h3>
            <p className="text-purple-200 mb-4">
              Experimenta la interfaz completa de Moises con mixer, diagramas de guitarra y controles profesionales
            </p>
            <button
              onClick={() => setShowMoisesInterface(true)}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200"
            >
              🎵 Abrir Interfaz Moises
            </button>
          </div>
        )}

        {/* Main Features Panel */}
        {audioUrl && !showMoisesInterface && (
          <MoisesFeatures
            audioUrl={audioUrl}
            duration={duration}
          />
        )}

        {/* Moises Style Interface */}
        {showMoisesInterface && (
          <MoisesStyleInterface
            audioUrl={audioUrl}
            songTitle={selectedFile?.name || "Mi plenitud - Yeshua | Marcos Brunet | TOMATULUGAR"}
            bpm={120}
            key="E"
            onClose={() => setShowMoisesInterface(false)}
          />
        )}

        {/* Individual Feature Tests */}
        {audioUrl && (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-center">Pruebas Individuales</h2>
            
            {/* Chord Analyzer Test */}
            <div className="bg-dark-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">🎼 Análisis de Acordes</h3>
              <ChordAnalyzer audioUrl={audioUrl} />
            </div>

            {/* Tempo/Pitch Controller Test */}
            <div className="bg-dark-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">🎵 Control de Tempo y Tono</h3>
              <TempoPitchController audioUrl={audioUrl} />
            </div>

            {/* Loop Sections Test */}
            <div className="bg-dark-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">🔄 Loop Sections</h3>
              <LoopSections 
                audioUrl={audioUrl} 
                duration={duration} 
              />
            </div>

            {/* Audio Analyzer Test */}
            <div className="bg-dark-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">📊 Análisis de Audio</h3>
              <AudioAnalyzer audioUrl={audioUrl} />
            </div>
          </div>
        )}

        {/* Instructions */}
        {!audioUrl && (
          <div className="bg-blue-900 bg-opacity-30 rounded-lg p-8 text-center">
            <Music className="h-16 w-16 mx-auto mb-4 text-blue-400" />
            <h3 className="text-2xl font-bold mb-4">¡Bienvenido al Clone de Moises!</h3>
            <p className="text-lg text-blue-200 mb-6">
              Carga un archivo de audio para probar todas las funcionalidades implementadas:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
              <div className="bg-blue-800 bg-opacity-30 rounded-lg p-4">
                <h4 className="font-semibold text-blue-300 mb-2">🎼 Análisis de Acordes</h4>
                <p className="text-sm text-blue-200">
                  Detección automática de acordes, tonalidad y progresiones musicales
                </p>
              </div>
              <div className="bg-green-800 bg-opacity-30 rounded-lg p-4">
                <h4 className="font-semibold text-green-300 mb-2">🎵 Control de Tempo/Tono</h4>
                <p className="text-sm text-green-200">
                  Cambio de velocidad y tonalidad sin afectar la calidad
                </p>
              </div>
              <div className="bg-purple-800 bg-opacity-30 rounded-lg p-4">
                <h4 className="font-semibold text-purple-300 mb-2">🔄 Loop Sections</h4>
                <p className="text-sm text-purple-200">
                  Creación de loops de secciones específicas
                </p>
              </div>
              <div className="bg-red-800 bg-opacity-30 rounded-lg p-4">
                <h4 className="font-semibold text-red-300 mb-2">📊 Análisis de Audio</h4>
                <p className="text-sm text-red-200">
                  Visualización espectral y métricas de calidad
                </p>
              </div>
              <div className="bg-indigo-800 bg-opacity-30 rounded-lg p-4">
                <h4 className="font-semibold text-indigo-300 mb-2">🤖 Separación de Pistas</h4>
                <p className="text-sm text-indigo-200">
                  IA para separar voces, batería, bajo y otros instrumentos
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
