/**
 * Moises Style Page
 * Página para probar la nueva arquitectura estilo Moises
 */

'use client';

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import MoisesStyleUpload from '../../components/MoisesStyleUpload';
import { getUserSongs } from '../../lib/firestore';
import { Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SongData {
  id: string;
  title: string;
  artist: string;
  original_url: string;
  stems: {
    vocals?: string;
    instrumental?: string;
    drums?: string;
    bass?: string;
    other?: string;
  };
  processed_at: string;
  task_id: string;
  song_id: string;
}

const MoisesStylePage: React.FC = () => {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [uploadedSongs, setUploadedSongs] = useState<SongData[]>([]);
  const [userSongs, setUserSongs] = useState<any[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);

  const handleUploadComplete = (songData: SongData) => {
    setUploadedSongs(prev => [songData, ...prev]);
    loadUserSongs(); // Recargar canciones del usuario
  };

  const loadUserSongs = async () => {
    if (!user) return;
    
    setLoadingSongs(true);
    try {
      const songs = await getUserSongs(user.uid);
      setUserSongs(songs);
    } catch (error) {
      console.error('Error loading user songs:', error);
    } finally {
      setLoadingSongs(false);
    }
  };

  const playAudio = (url: string, name: string) => {
    const audio = new Audio(url);
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
      alert(`Error reproduciendo ${name}: ${error.message}`);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            🔐 Acceso Requerido
          </h1>
          <p className="text-gray-600">
            Necesitas iniciar sesión para usar Moises Style
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
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
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎵 Moises Style Upload
          </h1>
          <p className="text-gray-600">
            Arquitectura simplificada estilo Moises - Solo B2 Storage
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Usuario: {user.displayName || user.email}
          </p>
        </div>

        {/* Upload Component */}
        <div className="mb-8">
          <MoisesStyleUpload onUploadComplete={handleUploadComplete} />
        </div>

        {/* Recent Uploads */}
        {uploadedSongs.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              🚀 Últimas Subidas
            </h2>
            <div className="grid gap-4">
              {uploadedSongs.map((song, index) => (
                <div key={index} className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{song.title}</h3>
                      <p className="text-gray-600">por {song.artist}</p>
                      <p className="text-sm text-gray-500">
                        Procesado: {new Date(song.processed_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Task ID: {song.task_id}</p>
                      <p className="text-sm text-gray-500">Song ID: {song.song_id}</p>
                    </div>
                  </div>
                  
                  {/* Audio Players */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">🎵 Original</h4>
                      <button
                        onClick={() => playAudio(song.original_url, 'Original')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        ▶️ Reproducir Original
                      </button>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">🎤 Stems Separados</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(song.stems).map(([stemName, stemUrl]) => (
                          <div key={stemName} className="flex items-center space-x-3">
                            <span className="text-sm font-medium text-gray-600 capitalize">
                              {stemName === 'vocals' ? '🎤 Vocals' :
                               stemName === 'instrumental' ? '🎸 Instrumental' :
                               stemName === 'drums' ? '🥁 Drums' :
                               stemName === 'bass' ? '🎸 Bass' :
                               stemName === 'other' ? '🎹 Other' : stemName}
                            </span>
                            <button
                              onClick={() => playAudio(stemUrl as string, stemName)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                            >
                              ▶️
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Songs from Firestore */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">
              📚 Mis Canciones (Firestore)
            </h2>
            <button
              onClick={loadUserSongs}
              disabled={loadingSongs}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {loadingSongs ? 'Cargando...' : '🔄 Recargar'}
            </button>
          </div>
          
          {userSongs.length > 0 ? (
            <div className="grid gap-4">
              {userSongs.map((song) => (
                <div key={song.id} className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{song.title}</h3>
                      <p className="text-gray-600">por {song.artist}</p>
                      <p className="text-sm text-gray-500">
                        Subido: {new Date(song.uploadedAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        Estado: <span className={`px-2 py-1 rounded text-xs ${
                          song.status === 'completed' ? 'bg-green-100 text-green-800' :
                          song.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {song.status}
                        </span>
                      </p>
                    </div>
                  </div>
                  
                  {song.stems && Object.keys(song.stems).length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">🎤 Stems Disponibles</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(song.stems).map(([stemName, stemUrl]) => (
                          <div key={stemName} className="flex items-center space-x-3">
                            <span className="text-sm font-medium text-gray-600 capitalize">
                              {stemName === 'vocals' ? '🎤 Vocals' :
                               stemName === 'instrumental' ? '🎸 Instrumental' :
                               stemName === 'drums' ? '🥁 Drums' :
                               stemName === 'bass' ? '🎸 Bass' :
                               stemName === 'other' ? '🎹 Other' : stemName}
                            </span>
                            <button
                              onClick={() => playAudio(stemUrl as string, stemName)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                            >
                              ▶️
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No hay canciones guardadas en Firestore</p>
              <p className="text-sm text-gray-400 mt-2">
                Sube tu primera canción usando el formulario de arriba
              </p>
            </div>
          )}
        </div>

        {/* API Status */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Estado del Sistema</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">✅</div>
              <div className="text-sm text-green-800">Frontend Next.js</div>
              <div className="text-xs text-green-600">Puerto 3000</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">🚀</div>
              <div className="text-sm text-blue-800">API Moises Style</div>
              <div className="text-xs text-blue-600">Puerto 8001</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">☁️</div>
              <div className="text-sm text-purple-800">B2 Storage</div>
              <div className="text-xs text-purple-600">Cloud Storage</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoisesStylePage;
