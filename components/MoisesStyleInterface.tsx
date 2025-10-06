/**
 * MoisesStyleInterface - Interfaz estilo Moises con mixer y diagramas de guitarra
 * Basado en la interfaz real de Moises.ai
 */

import React, { useState, useRef } from 'react';
import { Play, Pause, Volume2, RotateCcw, Download, Settings } from 'lucide-react';
import GuitarChordDiagram from './GuitarChordDiagram';

interface MoisesStyleInterfaceProps {
  audioUrl?: string;
  songTitle?: string;
  artist?: string;
  bpm?: number;
  key?: string;
  chords?: any[];
  onClose?: () => void;
}

const MoisesStyleInterface: React.FC<MoisesStyleInterfaceProps> = ({
  audioUrl,
  songTitle = "Mi plenitud - Yeshua | Marcos Brunet | TOMATULUGAR",
  artist = "Marcos Brunet",
  bpm = 126,
  key: songKey = "E",
  chords = [],
  onClose
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [trackVolumes, setTrackVolumes] = useState({
    vocals: 0.8,
    drums: 0.7,
    bass: 0.6,
    other: 0.5
  });
  const [trackPans, setTrackPans] = useState({
    vocals: 0,
    drums: 0,
    bass: 0,
    other: 0
  });
  const audioRef = useRef<HTMLAudioElement>(null);

  // Datos de acordes simulados (como en la imagen)
  const chordData = [
    {
      chord: "C#m",
      type: "minor",
      frets: [4, 2, 4, 3, 0, 0],
      fingers: [4, 1, 3, 2, 0, 0],
      muted: [true, false, false, false, false, false],
      open: [false, false, false, false, true, true]
    },
    {
      chord: "G#m",
      type: "minor",
      frets: [4, 6, 6, 4, 4, 4],
      fingers: [1, 3, 4, 1, 1, 1],
      muted: [false, false, false, false, false, false],
      open: [false, false, false, false, false, false],
      capo: 4
    },
    {
      chord: "A",
      type: "major",
      frets: [0, 2, 2, 2, 2, 0],
      fingers: [0, 1, 2, 3, 4, 0],
      muted: [true, false, false, false, false, false],
      open: [false, true, false, false, false, true]
    }
  ];

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const handleVolumeChange = (track: string, volume: number) => {
    setTrackVolumes(prev => ({ ...prev, [track]: volume }));
  };

  const handlePanChange = (track: string, pan: number) => {
    setTrackPans(prev => ({ ...prev, [track]: pan }));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-white truncate max-w-md">
              {songTitle}
            </h1>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <span>BPM: -</span>
              <span>•</span>
              <span>Key: {songKey}</span>
              <span>•</span>
              <span>4/4</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
              Separate tracks
            </button>
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm">
              Export
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-screen">
        {/* Left Sidebar - Mixer */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 space-y-6">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Mixer
          </h3>
          
          {/* Track Controls */}
          {Object.entries(trackVolumes).map(([track, volume]) => (
            <div key={track} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300 capitalize">
                  {track}
                </span>
                <span className="text-xs text-gray-500">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              
              {/* Volume Slider */}
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => handleVolumeChange(track, parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume * 100}%, #374151 ${volume * 100}%, #374151 100%)`
                  }}
                />
              </div>
              
              {/* Pan Control */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">L</span>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={trackPans[track as keyof typeof trackPans]}
                  onChange={(e) => handlePanChange(track, parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-500">R</span>
              </div>
            </div>
          ))}
          
          {/* Reset Button */}
          <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm">
            Reset
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Audio Player */}
          {audioUrl && (
            <div className="bg-gray-800 border-b border-gray-700 p-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handlePlayPause}
                  className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-full"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
                <div className="flex-1">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>{formatTime(currentTime)}</span>
                    <span>3:45</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(currentTime / 225) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chords Section */}
          <div className="flex-1 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Chords</h2>
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
                Easy
              </button>
            </div>

            {/* Chord Diagrams */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {chordData.map((chord, index) => (
                <GuitarChordDiagram
                  key={index}
                  chord={chord.chord}
                  chordType={chord.type}
                  frets={chord.frets}
                  fingers={chord.fingers}
                  muted={chord.muted}
                  open={chord.open}
                  capo={chord.capo}
                  className="hover:bg-gray-700 transition-colors cursor-pointer"
                />
              ))}
            </div>

            {/* Additional Info */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Song Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">BPM:</span>
                    <span className="text-white">-</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Key:</span>
                    <span className="text-white">{songKey}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Time Signature:</span>
                    <span className="text-white">4/4</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Chord Progression</h3>
                <div className="flex space-x-2">
                  {chordData.map((chord, index) => (
                    <div
                      key={index}
                      className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium"
                    >
                      {chord.chord}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
};

export default MoisesStyleInterface;

