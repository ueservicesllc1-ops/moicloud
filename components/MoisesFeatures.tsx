/**
 * MoisesFeatures - Panel principal con todas las funcionalidades de Moises
 * Integra: Análisis de acordes, Control de tempo/tono, Loop sections, Análisis de audio
 */

import React, { useState } from 'react';
import { Music, Zap, Repeat, BarChart3, X } from 'lucide-react';
import ChordAnalyzer from './ChordAnalyzer';
import TempoPitchController from './TempoPitchController';
import LoopSections from './LoopSections';
import AudioAnalyzer from './AudioAnalyzer';

interface MoisesFeaturesProps {
  audioUrl?: string;
  duration?: number;
  onClose?: () => void;
}

type FeatureTab = 'chords' | 'tempo' | 'loops' | 'analysis';

const MoisesFeatures: React.FC<MoisesFeaturesProps> = ({
  audioUrl,
  duration,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<FeatureTab>('chords');
  const [isExpanded, setIsExpanded] = useState(false);

  const features = [
    {
      id: 'chords' as FeatureTab,
      name: 'Análisis de Acordes',
      icon: Music,
      description: 'Detección automática de acordes y tonalidad',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500'
    },
    {
      id: 'tempo' as FeatureTab,
      name: 'Tempo y Tono',
      icon: Zap,
      description: 'Control de velocidad y tonalidad',
      color: 'text-green-400',
      bgColor: 'bg-green-500'
    },
    {
      id: 'loops' as FeatureTab,
      name: 'Loop Sections',
      icon: Repeat,
      description: 'Loop de secciones específicas',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500'
    },
    {
      id: 'analysis' as FeatureTab,
      name: 'Análisis de Audio',
      icon: BarChart3,
      description: 'Visualización y análisis avanzado',
      color: 'text-red-400',
      bgColor: 'bg-red-500'
    }
  ];

  const renderActiveFeature = () => {
    switch (activeTab) {
      case 'chords':
        return <ChordAnalyzer audioUrl={audioUrl} />;
      case 'tempo':
        return <TempoPitchController audioUrl={audioUrl} />;
      case 'loops':
        return <LoopSections audioUrl={audioUrl} duration={duration} />;
      case 'analysis':
        return <AudioAnalyzer audioUrl={audioUrl} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-dark-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Music className="h-6 w-6 mr-2" />
              Funcionalidades de Moises
            </h2>
            <p className="text-primary-200 mt-1">
              Herramientas profesionales de análisis y manipulación de audio
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>
      </div>

      {/* Feature Tabs */}
      <div className="bg-gray-700 p-4">
        <div className="flex flex-wrap gap-2">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <button
                key={feature.id}
                onClick={() => setActiveTab(feature.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  activeTab === feature.id
                    ? `${feature.bgColor} text-white shadow-lg`
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{feature.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feature Description */}
      <div className="bg-gray-600 px-6 py-3">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${features.find(f => f.id === activeTab)?.bgColor}`} />
          <span className="text-gray-300 text-sm">
            {features.find(f => f.id === activeTab)?.description}
          </span>
        </div>
      </div>

      {/* Feature Content */}
      <div className="p-6">
        {renderActiveFeature()}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-700 p-4 border-t border-gray-600">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-400">
            💡 <strong>Tip:</strong> Todas las funcionalidades trabajan en conjunto para una experiencia completa
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded text-sm"
            >
              {isExpanded ? 'Contraer' : 'Expandir'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Info */}
      {isExpanded && (
        <div className="bg-gray-800 p-6 border-t border-gray-600">
          <h3 className="text-lg font-semibold text-white mb-4">Funcionalidades Implementadas</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-blue-900 bg-opacity-30 rounded-lg p-4">
                <h4 className="text-blue-400 font-semibold mb-2">🎼 Análisis de Acordes</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Detección automática de acordes</li>
                  <li>• Análisis de tonalidad</li>
                  <li>• Progresiones de acordes</li>
                  <li>• Confianza de detección</li>
                </ul>
              </div>

              <div className="bg-green-900 bg-opacity-30 rounded-lg p-4">
                <h4 className="text-green-400 font-semibold mb-2">🎵 Control de Tempo/Tono</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Cambio de tempo sin afectar tono</li>
                  <li>• Pitch shifting sin afectar tempo</li>
                  <li>• Presets predefinidos</li>
                  <li>• Control en tiempo real</li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-purple-900 bg-opacity-30 rounded-lg p-4">
                <h4 className="text-purple-400 font-semibold mb-2">🔄 Loop Sections</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Creación de secciones personalizadas</li>
                  <li>• Loop automático</li>
                  <li>• Secciones predefinidas</li>
                  <li>• Navegación visual</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-red-900 bg-opacity-30 rounded-lg p-4">
            <h4 className="text-red-400 font-semibold mb-2">📊 Análisis de Audio</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Visualización de waveform</li>
              <li>• Análisis espectral en tiempo real</li>
              <li>• Métricas de calidad de audio</li>
              <li>• Características espectrales</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoisesFeatures;

