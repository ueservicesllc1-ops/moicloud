/**
 * ChordAnalyzer - Componente para análisis de acordes y tonalidad
 * Basado en las funcionalidades de Moises.ai
 */

import React, { useState, useEffect, useRef } from 'react';
import { Music, Clock, Key, TrendingUp, Play, Pause, RotateCcw, Eye } from 'lucide-react';
import ChordDisplayModal from './ChordDisplayModal';

interface ChordInfo {
  chord: string;
  confidence: number;
  start_time: number;
  end_time: number;
  root_note: string;
  chord_type: string;
}

interface KeyInfo {
  key: string;
  mode: string;
  confidence: number;
  tonic: string;
}

interface ChordAnalyzerProps {
  audioUrl?: string;
  onClose?: () => void;
}

const ChordAnalyzer: React.FC<ChordAnalyzerProps> = ({ audioUrl, onClose }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [chords, setChords] = useState<ChordInfo[]>([]);
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  const [selectedChord, setSelectedChord] = useState<ChordInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showChordModal, setShowChordModal] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Colores para diferentes tipos de acordes
  const chordColors = {
    'major': 'bg-green-500',
    'minor': 'bg-blue-500',
    'diminished': 'bg-red-500',
    'augmented': 'bg-yellow-500',
    'sus2': 'bg-purple-500',
    'sus4': 'bg-pink-500',
    'major7': 'bg-green-600',
    'minor7': 'bg-blue-600',
    'dominant7': 'bg-orange-500',
    'minor7b5': 'bg-red-600',
    'major9': 'bg-green-700',
    'minor9': 'bg-blue-700',
    'add9': 'bg-purple-600',
    '6': 'bg-yellow-600',
    'minor6': 'bg-blue-800'
  };

  const analyzeChords = async () => {
    if (!audioUrl) return;

    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);

      // Simular análisis (en producción sería una llamada real al backend)
      const mockChords: ChordInfo[] = [
        {
          chord: 'C',
          confidence: 0.95,
          start_time: 0,
          end_time: 4.2,
          root_note: 'C',
          chord_type: 'major'
        },
        {
          chord: 'Am',
          confidence: 0.88,
          start_time: 4.2,
          end_time: 8.1,
          root_note: 'A',
          chord_type: 'minor'
        },
        {
          chord: 'F',
          confidence: 0.92,
          start_time: 8.1,
          end_time: 12.0,
          root_note: 'F',
          chord_type: 'major'
        },
        {
          chord: 'G',
          confidence: 0.89,
          start_time: 12.0,
          end_time: 16.0,
          root_note: 'G',
          chord_type: 'major'
        }
      ];

      const mockKeyInfo: KeyInfo = {
        key: 'C major',
        mode: 'major',
        confidence: 0.87,
        tonic: 'C'
      };

      // Simular progreso
      for (let i = 0; i <= 100; i += 10) {
        setAnalysisProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setChords(mockChords);
      setKeyInfo(mockKeyInfo);
      setIsAnalyzing(false);

    } catch (error) {
      console.error('Error analyzing chords:', error);
      setIsAnalyzing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const getChordColor = (chordType: string) => {
    return chordColors[chordType as keyof typeof chordColors] || 'bg-gray-500';
  };

  const ChordProgression = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center">
        <TrendingUp className="h-5 w-5 mr-2" />
        Progresión de Acordes
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {chords.map((chord, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg text-center cursor-pointer transition-all duration-200 hover:scale-105 ${
              selectedChord === chord 
                ? 'ring-2 ring-primary-400 shadow-lg' 
                : 'hover:shadow-md'
            } ${getChordColor(chord.chord_type)}`}
            onClick={() => setSelectedChord(chord)}
          >
            <div className="text-white font-bold text-lg">{chord.chord}</div>
            <div className="text-white text-xs opacity-80">
              {formatTime(chord.start_time)} - {formatTime(chord.end_time)}
            </div>
            <div className="text-white text-xs opacity-60">
              {(chord.confidence * 100).toFixed(0)}% confianza
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ChordDetails = () => {
    if (!selectedChord) return null;

    return (
      <div className="bg-gray-800 rounded-lg p-4 space-y-3">
        <h4 className="text-white font-semibold">Detalles del Acorde</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Acorde:</span>
            <span className="text-white ml-2 font-medium">{selectedChord.chord}</span>
          </div>
          <div>
            <span className="text-gray-400">Nota raíz:</span>
            <span className="text-white ml-2">{selectedChord.root_note}</span>
          </div>
          <div>
            <span className="text-gray-400">Tipo:</span>
            <span className="text-white ml-2">{selectedChord.chord_type}</span>
          </div>
          <div>
            <span className="text-gray-400">Confianza:</span>
            <span className="text-white ml-2">{(selectedChord.confidence * 100).toFixed(0)}%</span>
          </div>
          <div>
            <span className="text-gray-400">Inicio:</span>
            <span className="text-white ml-2">{formatTime(selectedChord.start_time)}</span>
          </div>
          <div>
            <span className="text-gray-400">Fin:</span>
            <span className="text-white ml-2">{formatTime(selectedChord.end_time)}</span>
          </div>
        </div>
      </div>
    );
  };

  const KeyAnalysis = () => {
    if (!keyInfo) return null;

    return (
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white flex items-center mb-3">
          <Key className="h-5 w-5 mr-2" />
          Análisis de Tonalidad
        </h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-purple-200">Tonalidad:</span>
            <span className="text-white ml-2 font-bold text-lg">{keyInfo.key}</span>
          </div>
          <div>
            <span className="text-purple-200">Modo:</span>
            <span className="text-white ml-2 capitalize">{keyInfo.mode}</span>
          </div>
          <div>
            <span className="text-purple-200">Tónica:</span>
            <span className="text-white ml-2 font-medium">{keyInfo.tonic}</span>
          </div>
          <div>
            <span className="text-purple-200">Confianza:</span>
            <span className="text-white ml-2">{(keyInfo.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-dark-800 rounded-lg p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Music className="h-6 w-6 mr-2" />
          Análisis de Acordes
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

      {/* Progress Bar */}
      {isAnalyzing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-300">
            <span>Analizando acordes...</span>
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
      {!isAnalyzing && chords.length === 0 && (
        <div className="text-center py-8">
          <button
            onClick={analyzeChords}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center mx-auto"
          >
            <Music className="h-5 w-5 mr-2" />
            Analizar Acordes
          </button>
        </div>
      )}

      {/* Results */}
      {chords.length > 0 && (
        <div className="space-y-6">
          <KeyAnalysis />
          <ChordProgression />
          <ChordDetails />
        </div>
      )}

      {/* Audio Element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        />
      )}

      {/* Controls */}
      {chords.length > 0 && (
        <div className="flex justify-center space-x-4">
          <button
            onClick={handlePlayPause}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center"
          >
            {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {isPlaying ? 'Pausar' : 'Reproducir'}
          </button>
          <button
            onClick={() => setShowChordModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver Acordes en Tiempo Real
          </button>
          <button
            onClick={() => {
              setSelectedChord(null);
              setCurrentTime(0);
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
              }
            }}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reiniciar
          </button>
        </div>
      )}

      {/* Chord Display Modal */}
      <ChordDisplayModal
        isOpen={showChordModal}
        onClose={() => setShowChordModal(false)}
        chords={chords}
        audioUrl={audioUrl}
        currentTime={currentTime}
        onTimeChange={setCurrentTime}
      />
    </div>
  );
};

export default ChordAnalyzer;
