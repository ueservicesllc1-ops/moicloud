/**
 * Moises Style Upload Component
 * Arquitectura simplificada estilo Moises:
 * - Solo B2 Storage
 * - URLs consistentes
 * - Sin almacenamiento local
 * - Flujo simplificado
 */

import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { saveSong } from '../lib/firestore';

interface MoisesStyleUploadProps {
  onUploadComplete?: (songData: any) => void;
}

interface SeparationOptions {
  separationType: string; // 'vocals-instrumental', 'vocals-drums-bass-other', 'vocals-chorus-drums-bass-piano'
  hiFiMode: boolean;
}

const MoisesStyleUpload: React.FC<MoisesStyleUploadProps> = ({ onUploadComplete }) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showNoFilePopup, setShowNoFilePopup] = useState(false);
  const [separationOptions, setSeparationOptions] = useState<SeparationOptions>({
    separationType: 'vocals-instrumental',
    hiFiMode: false
  });

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setUploadMessage(`Archivo seleccionado: ${file.name}`);
    }
  }, []);

  // Función para calcular la duración del audio
  const getAudioDuration = async (file: File): Promise<{duration: string, durationSeconds: number}> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        const durationSeconds = Math.floor(audio.duration);
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        resolve({ duration, durationSeconds });
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(audio.src);
        reject(new Error('Error al cargar el audio para calcular duración'));
      };
      
      audio.src = URL.createObjectURL(file);
    });
  };

  const getSeparationType = (options: SeparationOptions): string => {
    return options.separationType;
  };

  const handleUpload = async () => {
    if (!uploadedFile) {
      setShowNoFilePopup(true);
      return;
    }
    
    if (!user) {
      console.error('❌ No hay usuario:', { user });
      return;
    }

    console.log('🚀 Iniciando upload:', {
      fileName: uploadedFile.name,
      fileSize: uploadedFile.size,
      fileType: uploadedFile.type,
      userId: user.uid,
      separationType: getSeparationType(separationOptions),
      hiFi: separationOptions.hiFiMode
    });

    setIsUploading(true);
    setUploadProgress(0);
    setUploadMessage('Iniciando subida estilo Moises...');

    try {
      // Crear FormData
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('separation_type', getSeparationType(separationOptions));
      formData.append('hi_fi', separationOptions.hiFiMode.toString());
      formData.append('user_id', user.uid);

      console.log('📤 FormData creado:', {
        separationType: getSeparationType(separationOptions),
        hiFi: separationOptions.hiFiMode.toString(),
        userId: user.uid
      });

      setUploadProgress(20);
      setUploadMessage('📤 Enviando archivo al servidor...');

      console.log('🌐 Enviando request a:', 'http://localhost:8000/separate');
      
      // Llamar al backend original que ya tiene CORS configurado
      const response = await fetch('http://localhost:8000/separate', {
        method: 'POST',
        body: formData,
      });

      console.log('📡 Response recibida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      setUploadProgress(40);
      setUploadMessage('☁️ Subiendo archivo a la nube...');

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`Error del servidor (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Resultado Moises Style:', result);

      // Siempre usar formato Moises Style
      if (result.success && result.data) {
        setUploadMessage('🤖 Procesando con IA (Demucs)...');
        setUploadProgress(60);
        
        // El BPM ya viene calculado del backend
        let calculatedBPM = result.data.bpm || null;
        if (calculatedBPM) {
          console.log(`✅ BPM detectado por backend: ${calculatedBPM} (confianza: ${((result.data.bpm_confidence || 0) * 100).toFixed(1)}%)`);
        }
        
        setUploadMessage('💾 Guardando metadata en base de datos...');
        setUploadProgress(80);

        // Calcular duración del audio
        let audioDuration = { duration: '0:00', durationSeconds: 0 };
        try {
          audioDuration = await getAudioDuration(uploadedFile);
          console.log(`✅ Duración calculada: ${audioDuration.duration} (${audioDuration.durationSeconds}s)`);
        } catch (error) {
          console.warn('⚠️ No se pudo calcular la duración:', error);
        }

        // Calcular tonalidad (Key)
        let calculatedKey = '-';
        try {
          const keyResponse = await fetch(`http://localhost:8000/api/analyze-key-from-url?audio_url=${encodeURIComponent(result.data.original_url)}`);
          const keyData = await keyResponse.json();
          
          if (keyData.success && keyData.key_string) {
            calculatedKey = keyData.key_string;
            console.log(`✅ Tonalidad detectada: ${calculatedKey} (confianza: ${(keyData.confidence * 100).toFixed(1)}%)`);
          }
        } catch (error) {
          console.warn('⚠️ No se pudo calcular la tonalidad:', error);
        }

        // Calcular compás (Time Signature)
        let calculatedTimeSignature = '4/4';
        try {
          const timeSignatureResponse = await fetch(`http://localhost:8000/api/analyze-time-signature-from-url?audio_url=${encodeURIComponent(result.data.original_url)}`);
          const timeSignatureData = await timeSignatureResponse.json();
          
          if (timeSignatureData.success && timeSignatureData.time_signature) {
            calculatedTimeSignature = timeSignatureData.time_signature;
            console.log(`✅ Compás detectado: ${calculatedTimeSignature} (confianza: ${(timeSignatureData.confidence * 100).toFixed(1)}%)`);
          }
        } catch (error) {
          console.warn('⚠️ No se pudo calcular el compás, usando 4/4 por defecto:', error);
        }

        // Guardar en Firestore
        const songData = {
          title: uploadedFile.name.replace(/\.[^/.]+$/, ""), // Sin extensión
          artist: user.displayName || 'Usuario',
          genre: 'Unknown',
          bpm: calculatedBPM,
          key: calculatedKey,
          duration: audioDuration.duration,
          durationSeconds: audioDuration.durationSeconds,
          timeSignature: calculatedTimeSignature,
          album: '',
          thumbnail: '🎵',
          fileUrl: result.data.original_url,
          uploadedAt: new Date().toISOString(),
          userId: user.uid,
          fileSize: uploadedFile.size,
          fileName: uploadedFile.name,
          status: 'completed' as const,
          stems: result.data.stems,
          separationTaskId: result.data.task_id
        };

        const firestoreSongId = await saveSong(songData);
        console.log('✅ Guardado en Firestore:', firestoreSongId);

        setUploadProgress(100);
        setUploadMessage('🎉 ¡Separación completada exitosamente!');

        // Notificar al componente padre
        if (onUploadComplete) {
          const completeData = {
            ...songData,
            id: firestoreSongId,
            ...result.data
          };
          console.log('🎵 MoisesStyleUpload - Llamando onUploadComplete con:', completeData);
          onUploadComplete(completeData);
        } else {
          console.log('⚠️ MoisesStyleUpload - onUploadComplete no está definido');
        }

        // Reset después de un momento
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          setUploadMessage('');
          setUploadedFile(null);
        }, 2000);

      } else {
        throw new Error(result.error || 'Error en el procesamiento');
      }

    } catch (error) {
      console.error('❌ Error completo en upload:', {
        error,
        message: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setUploadMessage(`❌ Error: ${errorMessage}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleOptionChange = (option: keyof SeparationOptions) => {
    setSeparationOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-900 shadow-lg">
      <div className="space-y-6">

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Seleccionar Archivo de Audio
          </label>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="w-full p-3 border border-gray-600 bg-gray-800 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isUploading}
          />
          {uploadedFile && (
            <div className="mt-2 p-3 bg-green-900 border border-green-700">
              <p className="text-green-300">
                <strong>Archivo:</strong> {uploadedFile.name}
              </p>
              <p className="text-green-400 text-sm">
                <strong>Tamaño:</strong> {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        {/* Separation Options */}
        <div>
          <label className="block text-sm font-medium text-white mb-3">
            Opciones de Separación
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* Botón Rápido Voz + Pista */}
            <button
              onClick={() => {
                // Si ya está seleccionado, deseleccionar
                if (separationOptions.separationType === 'vocals-instrumental') {
                  setSeparationOptions({
                    separationType: 'vocals-instrumental',
                    hiFiMode: false
                  });
                } else {
                  // Configurar automáticamente para separación de voz + instrumental con Spleeter
                  setSeparationOptions({
                    separationType: 'vocals-instrumental',
                    hiFiMode: false
                  });
                }
              }}
              disabled={isUploading}
              className={`col-span-2 w-full p-4 border transition-all duration-300 font-medium relative shadow-lg overflow-hidden bg-black ${
                isUploading
                  ? 'border-white/20 bg-gradient-to-b from-white/10 via-white/5 to-transparent text-gray-500 cursor-not-allowed'
                  : separationOptions.separationType === 'vocals-instrumental'
                    ? 'border-white/30 bg-gradient-to-b from-white/20 via-white/10 to-transparent text-white hover:from-white/25 hover:via-white/15'
                    : 'border-white/20 bg-gradient-to-b from-white/10 via-white/5 to-transparent text-white hover:from-white/15 hover:via-white/8'
              }`}
            >
              🎤 Voz + Pista
              <div className={`w-4 h-2 rounded transition-colors absolute top-2 right-2 ${
                separationOptions.separationType === 'vocals-instrumental'
                  ? 'bg-blue-500 animate-pulse' 
                  : 'bg-gray-500'
              }`}></div>
            </button>
            
            {[
              { key: 'vocals', label: '🎤 Vocals', description: 'Voces principales' },
              { key: 'drums', label: '🥁 Drums', description: 'Batería y percusión' },
              { key: 'bass', label: '🎸 Bass', description: 'Línea de bajo' },
              { key: 'other', label: '🎹 Other', description: 'Otros instrumentos' }
            ].map(({ key, label, description }) => (
             <button
               key={key}
               onClick={() => handleOptionChange(key as keyof SeparationOptions)}
                disabled={isUploading}
               className={`p-3 border transition-all duration-300 text-left relative shadow-lg overflow-hidden bg-black ${
                 separationOptions[key as keyof SeparationOptions]
                   ? 'border-white/30 bg-gradient-to-b from-white/20 via-white/10 to-transparent text-white hover:from-white/25 hover:via-white/15'
                   : 'border-white/20 bg-gradient-to-b from-white/10 via-white/5 to-transparent text-white hover:from-white/15 hover:via-white/8'
               }`}
             >
               <div className={`w-4 h-2 rounded transition-colors absolute top-2 right-2 ${
                 separationOptions[key as keyof SeparationOptions] 
                   ? 'bg-blue-500 animate-pulse' 
                   : 'bg-gray-500'
               }`}></div>
               <div>
                 <div className="font-medium">{label}</div>
                 <div className="text-sm opacity-75">{description}</div>
               </div>
             </button>
            ))}
          </div>
        </div>

        {/* Hi-Fi Mode */}
        <div>
           <button
             onClick={() => handleOptionChange('hiFiMode')}
                disabled={isUploading}
             className={`w-full p-3 border transition-all duration-300 text-left relative shadow-lg overflow-hidden bg-black ${
               separationOptions.hiFiMode
                 ? 'border-white/30 bg-gradient-to-b from-white/20 via-white/10 to-transparent text-white hover:from-white/25 hover:via-white/15'
                 : 'border-white/20 bg-gradient-to-b from-white/10 via-white/5 to-transparent text-white hover:from-white/15 hover:via-white/8'
             }`}
           >
             <div className={`w-4 h-2 rounded transition-colors absolute top-2 right-2 ${
               separationOptions.hiFiMode ? 'bg-blue-500 animate-pulse' : 'bg-gray-500'
             }`}></div>
             <div>
               <div className="font-medium">🎚️ Modo Hi-Fi</div>
               <div className="text-sm opacity-75">Calidad superior (procesamiento más lento)</div>
             </div>
           </button>
        </div>


        {/* Upload Button / Progress Bar */}
        {isUploading ? (
          <div className="space-y-4">
            {/* Barra de progreso mejorada */}
            <div className="w-full bg-gray-800 h-8 relative overflow-hidden rounded-lg border border-gray-600">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out flex items-center justify-center animate-pulse"
                style={{ width: `${Math.max(uploadProgress, 20)}%` }}
              >
                <span className="text-white font-bold text-sm drop-shadow-lg">
                  {Math.max(uploadProgress, 20).toFixed(0)}%
                </span>
              </div>
              {/* Efecto de brillo que se mueve */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
            </div>
            
            {/* Mensaje de estado */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                <div className="w-3 h-3 bg-pink-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
              </div>
              <p className="text-white font-medium text-lg animate-pulse">
                {uploadMessage || 'Procesando...'}
              </p>
              <p className="text-gray-400 text-sm">
                ⏱️ No te preocupes, esto puede tardar varios minutos
              </p>
              <p className="text-gray-500 text-xs">
                🔄 Estamos separando tu audio con IA...
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className={`w-full py-3 px-6 font-medium text-white transition-all duration-300 shadow-lg overflow-hidden border bg-black ${
              isUploading
                ? 'bg-gradient-to-b from-white/10 via-white/5 to-transparent border-white/20 cursor-not-allowed'
                : 'bg-gradient-to-b from-white/10 via-white/5 to-transparent border-white/20 hover:from-white/15 hover:via-white/8 focus:ring-4 focus:ring-white/20'
            }`}
          >
            Separar Tracks
          </button>
        )}

      </div>

      {/* Popup para cuando no hay archivo */}
      {showNoFilePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black bg-gradient-to-b from-white/15 via-white/8 to-transparent border border-white/20 p-6 max-w-md mx-4 shadow-lg overflow-hidden">
            <div className="text-center">
              <h3 className="text-white text-lg font-semibold mb-4">
                Para separar los tracks...
              </h3>
              <p className="text-gray-300 mb-6">
                Primero sube una canción Bro
              </p>
              <button
                onClick={() => setShowNoFilePopup(false)}
                className="bg-black border border-white/20 bg-gradient-to-b from-white/10 via-white/5 to-transparent hover:from-white/15 hover:via-white/8 text-white px-6 py-2 transition-all duration-300 shadow-lg overflow-hidden"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoisesStyleUpload;
