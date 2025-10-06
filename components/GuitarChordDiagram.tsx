/**
 * GuitarChordDiagram - Diagrama de acordes de guitarra
 * Basado en la interfaz de Moises.ai
 */

import React from 'react';

interface GuitarChordDiagramProps {
  chord: string;
  chordType: string;
  frets: number[];
  fingers: number[];
  muted: boolean[];
  open: boolean[];
  capo?: number;
  className?: string;
}

const GuitarChordDiagram: React.FC<GuitarChordDiagramProps> = ({
  chord,
  chordType,
  frets,
  fingers,
  muted,
  open,
  capo = 0,
  className = ''
}) => {
  const strings = ['E', 'A', 'D', 'G', 'B', 'E'];
  const maxFret = Math.max(...frets.filter(f => f > 0));

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      {/* Chord Name */}
      <div className="text-center mb-3">
        <div className="text-lg font-bold text-white">{chord}</div>
        <div className="text-sm text-gray-400 capitalize">{chordType}</div>
      </div>

      {/* Fretboard */}
      <div className="flex justify-center">
        <div className="relative">
          {/* Capo indicator */}
          {capo > 0 && (
            <div className="absolute -top-6 left-0 right-0 text-center">
              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
                {capo}fr
              </span>
            </div>
          )}

          {/* Fretboard */}
          <div className="relative">
            {/* Strings (vertical lines) */}
            {strings.map((string, stringIndex) => (
              <div key={stringIndex} className="absolute" style={{ left: `${stringIndex * 20}px` }}>
                {/* String line */}
                <div 
                  className="absolute bg-gray-300 w-0.5"
                  style={{ 
                    height: `${maxFret * 25 + 50}px`,
                    top: '0px'
                  }}
                />
                
                {/* String label */}
                <div className="absolute -bottom-6 text-xs text-gray-400 font-bold">
                  {string}
                </div>
              </div>
            ))}

            {/* Frets (horizontal lines) */}
            {Array.from({ length: maxFret + 1 }, (_, fretIndex) => (
              <div
                key={fretIndex}
                className="absolute bg-gray-400 w-full h-0.5"
                style={{ top: `${fretIndex * 25 + 25}px` }}
              />
            ))}

            {/* Fingering */}
            {frets.map((fret, stringIndex) => {
              if (fret === 0) return null;
              
              const finger = fingers[stringIndex];
              const isMuted = muted[stringIndex];
              const isOpen = open[stringIndex];
              
              if (isMuted) {
                return (
                  <div
                    key={stringIndex}
                    className="absolute w-3 h-3 bg-red-500 rounded-full flex items-center justify-center"
                    style={{
                      left: `${stringIndex * 20 - 6}px`,
                      top: `${(fret - 1) * 25 + 12}px`
                    }}
                  >
                    <span className="text-white text-xs font-bold">X</span>
                  </div>
                );
              }
              
              if (isOpen) {
                return (
                  <div
                    key={stringIndex}
                    className="absolute w-3 h-3 bg-green-500 rounded-full flex items-center justify-center"
                    style={{
                      left: `${stringIndex * 20 - 6}px`,
                      top: `${(fret - 1) * 25 + 12}px`
                    }}
                  >
                    <span className="text-white text-xs font-bold">O</span>
                  </div>
                );
              }
              
              return (
                <div
                  key={stringIndex}
                  className="absolute w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white"
                  style={{
                    left: `${stringIndex * 20 - 12}px`,
                    top: `${(fret - 1) * 25 + 6}px`
                  }}
                >
                  <span className="text-white text-xs font-bold">{finger}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuitarChordDiagram;

