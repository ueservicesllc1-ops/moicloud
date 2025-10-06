/**
 * ChordDisplayModal - Modal para mostrar acordes en tiempo real
 * Basado en la funcionalidad de Moises.ai
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';

interface ChordInfo {
  chord: string;
  confidence: number;
  start_time: number;
  end_time: number;
  root_note: string;
  chord_type: string;
}

interface ChordDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  chords: ChordInfo[];
  audioUrl?: string;
  currentTime?: number;
  onTimeChange?: (time: number) => void;
}

const ChordDisplayModal: React.FC<ChordDisplayModalProps> = ({
  isOpen,
  onClose,
  chords,
  audioUrl,
  currentTime = 0,
  onTimeChange
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);
  const [nextChordIndex, setNextChordIndex] = useState(1);
  const [previousChordIndex, setPreviousChordIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Encontrar el acorde actual basado en el tiempo
  useEffect(() => {
    if (chords.length === 0) return;

    const currentChord = chords.findIndex(chord => 
      currentTime >= chord.start_time && currentTime < chord.end_time
    );

    if (currentChord !== -1) {
      setCurrentChordIndex(currentChord);
      setNextChordIndex(Math.min(currentChord + 1, chords.length - 1));
      setPreviousChordIndex(Math.max(currentChord - 1, 0));
    }
  }, [currentTime, chords]);

  // Cerrar modal con tecla ESC
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const handleSkipBack = () => {
    if (audioRef.current && previousChordIndex >= 0) {
      audioRef.current.currentTime = chords[previousChordIndex].start_time;
    }
  };

  const handleSkipForward = () => {
    if (audioRef.current && nextChordIndex < chords.length) {
      audioRef.current.currentTime = chords[nextChordIndex].start_time;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getChordColor = (chordType: string) => {
    const colors = {
      'major': 'from-green-500 to-green-600',
      'minor': 'from-blue-500 to-blue-600',
      'diminished': 'from-red-500 to-red-600',
      'augmented': 'from-yellow-500 to-yellow-600',
      'sus2': 'from-purple-500 to-purple-600',
      'sus4': 'from-pink-500 to-pink-600',
      'major7': 'from-green-600 to-green-700',
      'minor7': 'from-blue-600 to-blue-700',
      'dominant7': 'from-orange-500 to-orange-600',
      'minor7b5': 'from-red-600 to-red-700',
      'major9': 'from-green-700 to-green-800',
      'minor9': 'from-blue-700 to-blue-800',
      'add9': 'from-purple-600 to-purple-700',
      '6': 'from-yellow-600 to-yellow-700',
      'minor6': 'from-blue-800 to-blue-900'
    };
    return colors[chordType as keyof typeof colors] || 'from-gray-500 to-gray-600';
  };

  const getChordTypeColor = (chordType: string) => {
    const colors = {
      'major': 'text-green-300',
      'minor': 'text-blue-300',
      'diminished': 'text-red-300',
      'augmented': 'text-yellow-300',
      'sus2': 'text-purple-300',
      'sus4': 'text-pink-300',
      'major7': 'text-green-400',
      'minor7': 'text-blue-400',
      'dominant7': 'text-orange-300',
      'minor7b5': 'text-red-400',
      'major9': 'text-green-500',
      'minor9': 'text-blue-500',
      'add9': 'text-purple-400',
      '6': 'text-yellow-400',
      'minor6': 'text-blue-600'
    };
    return colors[chordType as keyof typeof colors] || 'text-gray-300';
  };

  if (!isOpen) return null;

  const currentChord = chords[currentChordIndex];
  const nextChord = chords[nextChordIndex];
  const previousChord = chords[previousChordIndex];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-dark-800 border border-white border-opacity-20 rounded-lg p-6 w-full max-w-4xl mx-4 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">🎼 Acordes en Tiempo Real</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Audio Element */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={() => {
              if (audioRef.current && onTimeChange) {
                onTimeChange(audioRef.current.currentTime);
              }
            }}
          />
        )}

        {/* Main Chord Display */}
        <div className="space-y-8">
          {/* Previous Chord (faded) */}
          {previousChord && (
            <div className="text-center">
              <div className="text-gray-500 text-sm mb-2">Anterior</div>
              <div className="bg-gray-700 rounded-lg p-4 opacity-50">
                <div className="text-2xl font-bold text-gray-400">{previousChord.chord}</div>
                <div className="text-sm text-gray-500">
                  {formatTime(previousChord.start_time)} - {formatTime(previousChord.end_time)}
                </div>
              </div>
            </div>
          )}

          {/* Current Chord (highlighted) */}
          {currentChord && (
            <div className="text-center">
              <div className="text-white text-sm mb-4">Acorde Actual</div>
              <div className={`bg-gradient-to-r ${getChordColor(currentChord.chord_type)} rounded-2xl p-8 shadow-2xl transform scale-105 transition-all duration-500`}>
                <div className="text-6xl font-bold text-white mb-2">{currentChord.chord}</div>
                <div className="text-xl text-white opacity-90 capitalize">{currentChord.chord_type}</div>
                <div className="text-sm text-white opacity-75 mt-2">
                  {formatTime(currentChord.start_time)} - {formatTime(currentChord.end_time)}
                </div>
                <div className="text-sm text-white opacity-60">
                  Confianza: {(currentChord.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          )}

          {/* Next Chord (preview) */}
          {nextChord && (
            <div className="text-center">
              <div className="text-gray-400 text-sm mb-2">Siguiente</div>
              <div className="bg-gray-700 rounded-lg p-4 opacity-70">
                <div className="text-2xl font-bold text-gray-300">{nextChord.chord}</div>
                <div className={`text-sm ${getChordTypeColor(nextChord.chord_type)}`}>
                  {nextChord.chord_type}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatTime(nextChord.start_time)} - {formatTime(nextChord.end_time)}
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {currentChord && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>{formatTime(currentChord.start_time)}</span>
                <span>{formatTime(currentChord.end_time)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div 
                  className={`bg-gradient-to-r ${getChordColor(currentChord.chord_type)} h-2 rounded-full transition-all duration-300`}
                  style={{ 
                    width: `${Math.min(Math.max(((currentTime - currentChord.start_time) / (currentChord.end_time - currentChord.start_time)) * 100, 0), 100)}%` 
                  }}
                />
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={handleSkipBack}
              disabled={previousChordIndex < 0}
              className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center"
            >
              <SkipBack className="h-4 w-4 mr-2" />
              Anterior
            </button>
            
            <button
              onClick={handlePlayPause}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center text-lg"
            >
              {isPlaying ? <Pause className="h-5 w-5 mr-2" /> : <Play className="h-5 w-5 mr-2" />}
              {isPlaying ? 'Pausar' : 'Reproducir'}
            </button>
            
            <button
              onClick={handleSkipForward}
              disabled={nextChordIndex >= chords.length}
              className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center"
            >
              Siguiente
              <SkipForward className="h-4 w-4 ml-2" />
            </button>
          </div>

          {/* Chord Progression Timeline */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white text-center">Progresión de Acordes</h3>
            <div className="flex space-x-2 overflow-x-auto pb-2 max-w-full">
              {chords.map((chord, index) => (
                <div
                  key={index}
                  className={`flex-shrink-0 p-2 rounded-lg cursor-pointer transition-all duration-200 min-w-[60px] ${
                    index === currentChordIndex
                      ? 'bg-primary-500 text-white shadow-lg scale-110'
                      : index < currentChordIndex
                      ? 'bg-gray-600 text-gray-300'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = chord.start_time;
                    }
                  }}
                >
                  <div className="text-center">
                    <div className="font-bold text-xs">{chord.chord}</div>
                    <div className="text-xs opacity-75">
                      {formatTime(chord.start_time)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="text-center text-sm text-gray-400">
            💡 Haz clic en cualquier acorde de la progresión para saltar a esa parte
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChordDisplayModal;
