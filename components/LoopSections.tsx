/**
 * LoopSections - Componente para loop de secciones específicas
 * Basado en las funcionalidades de Moises.ai
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipBack, SkipForward, Repeat, Square } from 'lucide-react';

interface LoopSectionsProps {
  audioUrl?: string;
  duration?: number;
  onClose?: () => void;
}

interface LoopSection {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  color: string;
}

const LoopSections: React.FC<LoopSectionsProps> = ({
  audioUrl,
  duration = 180, // 3 minutos por defecto
  onClose
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const [loopSections, setLoopSections] = useState<LoopSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<LoopSection | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionStart, setNewSectionStart] = useState(0);
  const [newSectionEnd, setNewSectionEnd] = useState(10);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Colores para las secciones
  const sectionColors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-orange-500'
  ];

  // Secciones predefinidas comunes
  const predefinedSections = [
    { name: 'Intro', start: 0, end: 16 },
    { name: 'Verso 1', start: 16, end: 32 },
    { name: 'Coro', start: 32, end: 48 },
    { name: 'Verso 2', start: 48, end: 64 },
    { name: 'Puente', start: 64, end: 80 },
    { name: 'Solo', start: 80, end: 96 },
    { name: 'Outro', start: 96, end: 112 }
  ];

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      
      const updateTime = () => {
        setCurrentTime(audio.currentTime);
        
        // Si está en loop y llegó al final de la sección
        if (isLooping && selectedSection) {
          if (audio.currentTime >= selectedSection.endTime) {
            audio.currentTime = selectedSection.startTime;
          }
        }
      };
      
      audio.addEventListener('timeupdate', updateTime);
      return () => audio.removeEventListener('timeupdate', updateTime);
    }
  }, [isLooping, selectedSection]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeFromPosition = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return 0;
    const rect = progressRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    return percentage * duration;
  };

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const time = getTimeFromPosition(event);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const createSection = () => {
    if (!newSectionName.trim()) return;

    const newSection: LoopSection = {
      id: `section_${Date.now()}`,
      name: newSectionName,
      startTime: newSectionStart,
      endTime: newSectionEnd,
      color: sectionColors[loopSections.length % sectionColors.length]
    };

    setLoopSections([...loopSections, newSection]);
    setNewSectionName('');
    setNewSectionStart(0);
    setNewSectionEnd(10);
    setIsCreating(false);
  };

  const deleteSection = (sectionId: string) => {
    setLoopSections(loopSections.filter(s => s.id !== sectionId));
    if (selectedSection?.id === sectionId) {
      setSelectedSection(null);
      setIsLooping(false);
    }
  };

  const selectSection = (section: LoopSection) => {
    setSelectedSection(section);
    if (audioRef.current) {
      audioRef.current.currentTime = section.startTime;
      setCurrentTime(section.startTime);
    }
  };

  const startLoop = () => {
    if (selectedSection) {
      setIsLooping(true);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.currentTime = selectedSection.startTime;
        audioRef.current.play();
      }
    }
  };

  const stopLoop = () => {
    setIsLooping(false);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const jumpToSection = (section: LoopSection) => {
    if (audioRef.current) {
      audioRef.current.currentTime = section.startTime;
      setCurrentTime(section.startTime);
    }
  };

  const addPredefinedSection = (section: typeof predefinedSections[0]) => {
    const newSection: LoopSection = {
      id: `section_${Date.now()}`,
      name: section.name,
      startTime: section.start,
      endTime: section.end,
      color: sectionColors[loopSections.length % sectionColors.length]
    };

    setLoopSections([...loopSections, newSection]);
  };

  const ProgressBar = () => (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-gray-400">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      
      <div
        ref={progressRef}
        className="relative w-full h-4 bg-gray-700 rounded-lg cursor-pointer"
        onClick={handleProgressClick}
      >
        {/* Secciones */}
        {loopSections.map((section) => (
          <div
            key={section.id}
            className={`absolute h-full ${section.color} opacity-70 cursor-pointer hover:opacity-90 transition-opacity`}
            style={{
              left: `${(section.startTime / duration) * 100}%`,
              width: `${((section.endTime - section.startTime) / duration) * 100}%`
            }}
            onClick={(e) => {
              e.stopPropagation();
              selectSection(section);
            }}
            title={`${section.name}: ${formatTime(section.startTime)} - ${formatTime(section.endTime)}`}
          />
        ))}
        
        {/* Indicador de tiempo actual */}
        <div
          className="absolute top-0 h-full w-1 bg-white shadow-lg"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />
      </div>
    </div>
  );

  const SectionList = () => (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-white">Secciones de Loop</h3>
      
      {loopSections.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Repeat className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No hay secciones creadas</p>
          <p className="text-sm">Crea secciones para hacer loop de partes específicas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {loopSections.map((section) => (
            <div
              key={section.id}
              className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                selectedSection?.id === section.id
                  ? 'border-primary-400 bg-primary-900 bg-opacity-30'
                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded ${section.color}`} />
                  <div>
                    <div className="text-white font-medium">{section.name}</div>
                    <div className="text-gray-400 text-sm">
                      {formatTime(section.startTime)} - {formatTime(section.endTime)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => jumpToSection(section)}
                    className="text-gray-400 hover:text-white p-1"
                    title="Saltar a sección"
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => selectSection(section)}
                    className="text-gray-400 hover:text-white p-1"
                    title="Seleccionar"
                  >
                    <Square className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => deleteSection(section.id)}
                    className="text-red-400 hover:text-red-300 p-1"
                    title="Eliminar"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-dark-800 rounded-lg p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Repeat className="h-6 w-6 mr-2" />
          Loop de Secciones
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
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            if (isLooping && selectedSection) {
              audioRef.current!.currentTime = selectedSection.startTime;
            } else {
              setIsPlaying(false);
            }
          }}
        />
      )}

      {/* Progress Bar */}
      <ProgressBar />

      {/* Section List */}
      <SectionList />

      {/* Create New Section */}
      {isCreating ? (
        <div className="bg-gray-700 rounded-lg p-4 space-y-4">
          <h3 className="text-white font-semibold">Crear Nueva Sección</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-gray-300 text-sm mb-1">Nombre:</label>
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Ej: Coro, Verso, Solo..."
                className="w-full bg-gray-600 text-white p-2 rounded border border-gray-500 focus:border-primary-500 focus:outline-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Inicio (seg):</label>
                <input
                  type="number"
                  value={newSectionStart}
                  onChange={(e) => setNewSectionStart(parseFloat(e.target.value))}
                  min="0"
                  max={duration}
                  className="w-full bg-gray-600 text-white p-2 rounded border border-gray-500 focus:border-primary-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm mb-1">Fin (seg):</label>
                <input
                  type="number"
                  value={newSectionEnd}
                  onChange={(e) => setNewSectionEnd(parseFloat(e.target.value))}
                  min={newSectionStart + 1}
                  max={duration}
                  className="w-full bg-gray-600 text-white p-2 rounded border border-gray-500 focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setIsCreating(false)}
              className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded"
            >
              Cancelar
            </button>
            <button
              onClick={createSection}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded"
            >
              Crear
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => setIsCreating(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center font-medium"
          >
            <Repeat className="h-4 w-4 mr-2" />
            Crear Sección
          </button>
          
          <button
            onClick={() => {
              predefinedSections.forEach(addPredefinedSection);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center font-medium"
          >
            <Square className="h-4 w-4 mr-2" />
            Secciones Predefinidas
          </button>
        </div>
      )}

      {/* Loop Controls */}
      {selectedSection && (
        <div className="bg-primary-900 bg-opacity-30 rounded-lg p-4 space-y-4">
          <h3 className="text-white font-semibold">
            Sección Seleccionada: {selectedSection.name}
          </h3>
          
          <div className="flex justify-center space-x-4">
            <button
              onClick={isLooping ? stopLoop : startLoop}
              className={`${
                isLooping 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              } text-white px-8 py-3 rounded-lg flex items-center font-medium text-lg`}
            >
              {isLooping ? <Pause className="h-5 w-5 mr-2" /> : <Play className="h-5 w-5 mr-2" />}
              {isLooping ? 'Detener Loop' : 'Iniciar Loop'}
            </button>
            
            <button
              onClick={() => {
                setSelectedSection(null);
                setIsLooping(false);
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg flex items-center font-medium"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-gray-400 space-y-1">
        <div>🔄 <strong>Tip:</strong> Haz clic en la barra de progreso para navegar</div>
        <div>🎵 Las secciones se pueden superponer para crear loops complejos</div>
      </div>
    </div>
  );
};

export default LoopSections;

