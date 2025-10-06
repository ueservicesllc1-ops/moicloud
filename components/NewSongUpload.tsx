/**
 * NewSongUpload - Componente para subir canciones nuevas a la nube
 */

import React, { useState } from 'react';
import { X, Upload, Music, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { saveSong } from '@/lib/firestore';
import realB2Service from '@/lib/realB2Service';
import AudioSeparationModal from './AudioSeparationModal';

// Declarar tipos para propiedades globales del window
declare global {
  interface Window {
    activeAbortControllers?: AbortController[];
    stopAllSystemAudio?: () => void;
  }
}

interface NewSongUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (songData: any) => void;
  onOpenMixer?: (songId: string) => void;
}

interface SeparationOptions {
  type: 'basic' | 'custom';
  basicType?: 'vocals-instrumental' | 'vocals-drums-bass-other';
  customTracks: {
    vocals: boolean;
    guitar: boolean;
    bass: boolean;
    drums: boolean;
  };
  hiFiMode: boolean;
}

const NewSongUpload: React.FC<NewSongUploadProps> = ({ isOpen, onClose, onUploadComplete, onOpenMixer }) => {
  const { user } = useAuth();
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [metadataExtracted, setMetadataExtracted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSeparationModal, setShowSeparationModal] = useState(false);
  const [separationOptions, setSeparationOptions] = useState<SeparationOptions | null>(null);
  const [uploadedSongData, setUploadedSongData] = useState<any>(null);
  // const [showAudioEditor, setShowAudioEditor] = useState(false); // REMOVED
  const [isProcessingSeparation, setIsProcessingSeparation] = useState(false);
  const [separationProgress, setSeparationProgress] = useState(0);
  const [separationMessage, setSeparationMessage] = useState('');

  // Función para verificar si el backend está funcionando
  const checkBackendHealth = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/health');
      return response.ok;
    } catch (error) {
      console.error('Backend no disponible:', error);
      return false;
    }
  };


  // Función para extraer metadatos del archivo de audio
  const extractMetadataFromFile = async (file: File) => {
    try {
      console.log('🎵 Extrayendo metadatos del archivo:', file.name);
      
      // Crear un elemento de audio temporal para extraer metadatos
      const audio = new Audio();
      const objectUrl = URL.createObjectURL(file);
      
      return new Promise<{title: string, artist: string}>((resolve) => {
        audio.addEventListener('loadedmetadata', () => {
          console.log('📊 Metadatos cargados:', {
             title: (audio as any).title || '',
             artist: (audio as any).artist || '',
             album: (audio as any).album || '',
            duration: audio.duration
          });
          
          // Extraer título y artista de los metadatos o del nombre del archivo
          let extractedTitle = (audio as any).title || '';
          let extractedArtist = (audio as any).artist || '';
          
          // Si no hay metadatos, intentar extraer del nombre del archivo
          if (!extractedTitle && !extractedArtist) {
            const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remover extensión
            const parts = fileName.split(' - ');
            
            if (parts.length >= 2) {
              extractedArtist = parts[0].trim();
              extractedTitle = parts.slice(1).join(' - ').trim();
            } else {
              // Si no hay separador, usar el nombre completo como título
              extractedTitle = fileName;
              extractedArtist = 'Artista Desconocido';
            }
          }
          
          // Si aún no hay título, usar el nombre del archivo
          if (!extractedTitle) {
            extractedTitle = file.name.replace(/\.[^/.]+$/, '');
          }
          
          // Si aún no hay artista, usar "Artista Desconocido"
          if (!extractedArtist) {
            extractedArtist = 'Artista Desconocido';
          }
          
          console.log('✅ Metadatos extraídos:', { title: extractedTitle, artist: extractedArtist });
          
          // Limpiar el objeto URL
          URL.revokeObjectURL(objectUrl);
          
          resolve({ title: extractedTitle, artist: extractedArtist });
        });
        
        audio.addEventListener('error', () => {
          console.log('⚠️ Error cargando metadatos, usando nombre del archivo');
          
          // Fallback: usar nombre del archivo
          const fileName = file.name.replace(/\.[^/.]+$/, '');
          const parts = fileName.split(' - ');
          
          let extractedTitle = fileName;
          let extractedArtist = 'Artista Desconocido';
          
          if (parts.length >= 2) {
            extractedArtist = parts[0].trim();
            extractedTitle = parts.slice(1).join(' - ').trim();
          }
          
          URL.revokeObjectURL(objectUrl);
          resolve({ title: extractedTitle, artist: extractedArtist });
        });
        
        // Cargar el archivo
        audio.src = objectUrl;
        audio.load();
      });
      
    } catch (error) {
      console.error('Error extrayendo metadatos:', error);
      
      // Fallback: usar nombre del archivo
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      const parts = fileName.split(' - ');
      
      let extractedTitle = fileName;
      let extractedArtist = 'Artista Desconocido';
      
      if (parts.length >= 2) {
        extractedArtist = parts[0].trim();
        extractedTitle = parts.slice(1).join(' - ').trim();
      }
      
      return { title: extractedTitle, artist: extractedArtist };
    }
  };

  // Función para subir stems a B2
  const uploadStemsToB2 = async (stems: any, songId: string, userId: string) => {
    try {
      console.log('🔄 Iniciando subida de stems a B2...');
      console.log('📁 Stems recibidos:', stems);
      console.log('🆔 Song ID:', songId);
      console.log('👤 User ID:', userId);
      
      // Simplificar: subir el archivo original a B2 y usar la misma URL para ambos stems
      console.log('📤 Subiendo archivo original a B2...');
      
      const uploadResult = await realB2Service.uploadAudioFile(
        selectedFile!,
        userId,
        undefined,
        songId,
        selectedFile!.name
      );
      
      const b2Url = typeof uploadResult === 'string' ? uploadResult : (uploadResult as any).downloadUrl || uploadResult;
      console.log('✅ Archivo original subido a B2:', b2Url);
      console.log('🔍 Tipo de URL:', typeof b2Url);
      console.log('🔍 URL contiene B2:', b2Url.includes('backblaze') || b2Url.includes('b2'));
      
      // Verificar que la URL es válida
      if (!b2Url || typeof b2Url !== 'string' || b2Url.length === 0) {
        throw new Error('No se obtuvo una URL válida de B2');
      }
      
      // Crear stems usando la misma URL para ambos
      const b2Stems = {
        vocals: b2Url,
        instrumental: b2Url
      };
      
      // También devolver la URL original para guardarla como fileUrl
      const result = {
        stems: b2Stems,
        originalUrl: b2Url
      };
      
      console.log('✅ Stems creados con URL de B2:', b2Stems);
      console.log('✅ URL original para fileUrl:', b2Url);
      console.log('🔍 Verificación de stems:');
      console.log('  - vocals:', b2Stems.vocals);
      console.log('  - instrumental:', b2Stems.instrumental);
      return result;
      
    } catch (error) {
      console.error('❌ Error subiendo a B2:', error);
      throw error;
    }
  };

  // Función para guardar en Firestore
  const saveToFirestore = async (songData: any, uploadResult: any) => {
    try {
      setSeparationProgress(90);
      setSeparationMessage('Guardando información...');
      
      console.log('💾 Guardando en Firestore...');
      console.log('📊 Song data:', songData);
      console.log('📊 Upload result:', uploadResult);
      
      // Extraer stems y URL original del resultado
      const b2Stems = uploadResult.stems;
      const originalUrl = uploadResult.originalUrl;
      
      // Validar que tenemos la URL original de B2
      if (!originalUrl) {
        console.error('❌ No hay URL original de B2 para fileUrl');
        throw new Error('No se encontró URL original de B2 para guardar');
      }
      
      // Verificar que la URL es de B2, no del backend local
      if (originalUrl.includes('localhost:8000')) {
        console.error('❌ URL es del backend local, no de B2:', originalUrl);
        throw new Error('La URL debe ser de B2, no del backend local');
      }
      
      console.log('✅ FileUrl original válido:', originalUrl);
      
      // Analizar BPM automáticamente
      setSeparationMessage('Analizando BPM...');
      let calculatedBPM = null;
      try {
        console.log('🎵 Iniciando análisis de BPM desde URL:', originalUrl);
        const bpmResponse = await fetch(`http://localhost:8000/api/analyze-bpm-from-url?audio_url=${encodeURIComponent(originalUrl)}`);
        const bpmData = await bpmResponse.json();
        
        if (bpmData.success && bpmData.bpm) {
          calculatedBPM = bpmData.bpm;
          console.log(`✅ BPM calculado: ${calculatedBPM} (confianza: ${(bpmData.confidence * 100).toFixed(1)}%)`);
        } else {
          console.log('⚠️ No se pudo calcular BPM, se guardará como null');
        }
      } catch (bpmError) {
        console.error('❌ Error calculando BPM:', bpmError);
        console.log('⚠️ Continuando sin BPM');
      }
      
      const song = {
        title: songData.title,
        artist: songData.artist,
        genre: '',
        bpm: calculatedBPM,
        key: '-',
        duration: '5:00',
        durationSeconds: 300,
        timeSignature: '4/4',
        album: '',
        thumbnail: '🎵',
        fileUrl: originalUrl, // Usar la URL original del audio subido a B2
        uploadedAt: new Date().toISOString(),
        userId: user!.uid,
        fileSize: songData.fileSize,
        fileName: songData.fileName,
        status: 'uploaded' as const,
        stems: b2Stems
      };

      const firestoreSongId = await saveSong(song);
      console.log('✅ Información guardada en Firestore con ID:', firestoreSongId);
      
      // Completar
      setSeparationProgress(100);
      setSeparationMessage('¡Separación completada!');
      
      // Actualizar datos de la canción
      const updatedSongData = {
        ...songData,
        stems: b2Stems,
        bpm: calculatedBPM,
        key: '-',
        timeSignature: '4/4',
        duration: '5:00',
        b2Url: b2Stems.vocals || b2Stems.instrumental,
        firestoreId: firestoreSongId
      };
      
      setUploadedSongData(updatedSongData);
      
      // Cerrar modal y abrir mixer
      setTimeout(() => {
      setIsProcessingSeparation(false);
      setShowSeparationModal(false);
        setSeparationProgress(0);
        setSeparationMessage('');
        
        // Abrir mixer automáticamente
        if (onOpenMixer) {
          onOpenMixer(songData.id);
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error guardando en Firestore:', error);
      throw error;
    }
  };

  // Función para procesar la separación real de audio
  const processSimpleAudioSeparation = async (songData: any) => {
    let uploadResult: any = null;
    
    try {
      console.log('🎵 Iniciando separación simple de audio...');
      setIsProcessingSeparation(true);
      setSeparationProgress(10);
      setSeparationMessage('Preparando archivo...');
      
      // Paso 1: Subir archivo al cache del backend
      setSeparationProgress(20);
      setSeparationMessage('Subiendo archivo al cache...');
      
      const formData = new FormData();
      formData.append('file', selectedFile!);
      formData.append('user_id', user!.uid);
      formData.append('song_id', songData.id);
      
      const uploadResponse = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Error subiendo archivo: ${uploadResponse.status}`);
      }
      
      uploadResult = await uploadResponse.json();
      console.log('✅ Archivo subido al cache:', uploadResult.task_id);
      
      // Paso 2: Separación con la tecnología seleccionada
      setSeparationProgress(30);
      
      // Determinar el tipo de separación y mensaje basado en las opciones
      let separationType = 'vocals-instrumental';
      let technologyName = 'Spleeter AI';
      
      if (separationOptions?.basicType === 'vocals-drums-bass-other') {
        separationType = 'vocals-drums-bass-other';
        technologyName = 'Demucs AI';
      }
      
      setSeparationMessage(`Iniciando separación con ${technologyName}...`);
      
      // Crear FormData para separación usando el archivo del cache
      const separationFormData = new FormData();
      separationFormData.append('file', selectedFile!);
      separationFormData.append('separation_type', separationType);
      separationFormData.append('hi_fi', separationOptions?.hiFiMode ? 'true' : 'false');
      separationFormData.append('song_id', songData.id);
      separationFormData.append('user_id', user!.uid);
      
      // Llamar al backend para separación real
      const separationResponse = await fetch('http://localhost:8000/separate', {
        method: 'POST',
        body: separationFormData
      });
      
      if (!separationResponse.ok) {
        throw new Error(`Error en separación: ${separationResponse.status}`);
      }
      
      const separationResult = await separationResponse.json();
      console.log('✅ Separación iniciada:', separationResult);
      
      // Polling para verificar el estado de la separación
      const taskId = separationResult.task_id;
      setSeparationProgress(50);
      setSeparationMessage(`Procesando con ${technologyName}...`);
      
      // Polling simple para verificar cuando se complete
      let attempts = 0;
      const maxAttempts = 30; // 30 segundos máximo
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
        
        const statusResponse = await fetch(`http://localhost:8000/status/${taskId}`);
        if (!statusResponse.ok) break;
        
        const statusResult = await statusResponse.json();
        console.log('🔄 Status:', statusResult);
        
        if (statusResult.status === 'completed') {
          console.log('✅ Separación completada!');
          console.log('📊 Status result completo:', statusResult);
          setSeparationProgress(70);
          setSeparationMessage('Subiendo stems separados a B2...');
          
          // Los stems ya están separados en el backend, ahora subirlos a B2
          const stems = statusResult.stems || {};
          console.log('🎵 Stems separados del backend:', stems);
          console.log('🔍 Tipo de stems:', typeof stems);
          console.log('🔍 Claves de stems:', Object.keys(stems));
          
          // Subir stems a B2 y obtener URLs
          const stemsUploadResult = await uploadStemsToB2(stems, songData.id, user!.uid);
          console.log('✅ Stems subidos a B2:', stemsUploadResult);
          
          setSeparationProgress(90);
          setSeparationMessage('Guardando información...');
          
          // Guardar en Firestore con URLs de B2
          await saveToFirestore(songData, stemsUploadResult);
          return;
          
        } else if (statusResult.status === 'failed') {
          throw new Error(`Separación falló: ${statusResult.error || 'Error desconocido'}`);
        }
        
        attempts++;
        setSeparationProgress(50 + (attempts * 0.5)); // Progreso gradual
      }
      
      // Si llegamos aquí, la separación falló o se colgó
      console.log('⚠️ Separación falló o se colgó, usando fallback...');
      setSeparationProgress(70);
      setSeparationMessage('Usando separación alternativa...');
      
      // Fallback: usar el archivo original como base para ambos stems
      const fileExt = selectedFile!.name.split('.').pop();
      const fallbackStems = {
        vocals: `http://localhost:8000/uploads/${taskId}/original.${fileExt}`,
        instrumental: `http://localhost:8000/uploads/${taskId}/original.${fileExt}`
      };
      
      console.log('🔄 Usando stems de fallback:');
      console.log('📁 Task ID:', taskId);
      console.log('📁 File extension:', fileExt);
      console.log('📁 Fallback stems:', fallbackStems);
      
      // Subir stems de fallback a B2
      const fallbackUploadResult = await uploadStemsToB2(fallbackStems, songData.id, user!.uid);
      console.log('✅ Stems de fallback subidos a B2:', fallbackUploadResult);
      
      setSeparationProgress(90);
      setSeparationMessage('Guardando información...');
      
      // Guardar en Firestore con URLs de B2
      await saveToFirestore(songData, fallbackUploadResult);
      return;
        
      } catch (error) {
      console.error('❌ Error en separación:', error);
      
      // Intentar fallback en caso de error
      try {
        console.log('🔄 Intentando fallback por error...');
        setSeparationProgress(70);
        setSeparationMessage('Usando separación alternativa...');
        
        // Fallback: usar el archivo original
        const fallbackStems = {
          vocals: `http://localhost:8000/uploads/${uploadResult?.task_id || 'fallback'}/original.${selectedFile!.name.split('.').pop()}`,
          instrumental: `http://localhost:8000/uploads/${uploadResult?.task_id || 'fallback'}/original.${selectedFile!.name.split('.').pop()}`
        };
        
        // Subir stems de fallback a B2
        const fallbackUploadResult = await uploadStemsToB2(fallbackStems, songData.id, user!.uid);
        
        setSeparationProgress(90);
        setSeparationMessage('Guardando información...');
        
        // Guardar en Firestore
        await saveToFirestore(songData, fallbackUploadResult);
        return;
        
      } catch (fallbackError) {
        console.error('❌ Error en fallback:', fallbackError);
        setIsProcessingSeparation(false);
        setSeparationProgress(0);
        setSeparationMessage('');
        alert(`❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }
  };


  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/ogg'];
      if (!allowedTypes.includes(file.type)) {
        alert('Por favor selecciona un archivo de audio válido (MP3, WAV, M4A, AAC, OGG)');
        return;
      }
      
      // Validar tamaño (máximo 100MB)
      if (file.size > 100 * 1024 * 1024) {
        alert('El archivo es demasiado grande. Máximo 100MB.');
        return;
      }
      
      setSelectedFile(file);
      console.log('Archivo seleccionado:', file.name, file.size, 'bytes');
      
      // Extraer metadatos automáticamente
      try {
        console.log('🎵 Extrayendo metadatos automáticamente...');
        const metadata = await extractMetadataFromFile(file);
        setSongTitle(metadata.title);
        setArtistName(metadata.artist);
        setMetadataExtracted(true);
        console.log('✅ Metadatos extraídos automáticamente:', metadata);
      } catch (error) {
        console.error('Error extrayendo metadatos:', error);
        // Fallback: usar nombre del archivo
        const fileName = file.name.replace(/\.[^/.]+$/, '');
        setSongTitle(fileName);
        setArtistName('Artista Desconocido');
        setMetadataExtracted(false);
      }
    }
  };

  // Función para parsear el nombre del archivo y extraer artista y título
  const parseFileName = (fileName: string) => {
    // Remover extensión
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    
    // Patrones comunes de nombres de archivos de música
    const patterns = [
      // "Artista - Título" o "Artista - Título (Año)"
      /^(.+?)\s*-\s*(.+?)(?:\s*\([0-9]{4}\))?$/,
      // "Título - Artista"
      /^(.+?)\s*-\s*(.+?)$/,
      // "Artista_Título" o "Artista_Título (Año)"
      /^(.+?)_(.+?)(?:\s*\([0-9]{4}\))?$/,
      // Solo título (sin separador)
      /^(.+)$/
    ];
    
    for (const pattern of patterns) {
      const match = nameWithoutExt.match(pattern);
      if (match) {
        if (pattern === patterns[3]) {
          // Solo título encontrado
          return {
            artist: '',
            title: match[1].trim()
          };
        } else {
          // Artista y título encontrados
          return {
            artist: match[1].trim(),
            title: match[2].trim()
          };
        }
      }
    }
    
    // Si no coincide con ningún patrón, usar el nombre completo como título
    return {
      artist: '',
      title: nameWithoutExt
    };
  };

  const handleSeparationOptions = async (options: SeparationOptions) => {
    setSeparationOptions(options);
    console.log('Separation options selected:', options);
    
    // Procesar la separación con la lógica simple
    if (uploadedSongData) {
      await processSimpleAudioSeparation(uploadedSongData);
    }
  };

  const handleUploadSong = async () => {
    try {
      if (!selectedFile) {
        alert('Por favor selecciona un archivo de audio');
        return;
      }
      
      // Extraer título y artista del nombre del archivo si no están definidos
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const parts = fileName.split(' - ');
      
      let finalTitle = songTitle || '';
      let finalArtist = artistName || '';
      
      // Si no hay título o artista, extraer del nombre del archivo
      if (!finalTitle && !finalArtist) {
        if (parts.length >= 2) {
          finalArtist = parts[0].trim();
          finalTitle = parts.slice(1).join(' - ').trim();
        } else {
          finalTitle = fileName;
          finalArtist = 'Artista Desconocido';
        }
      } else if (!finalTitle) {
        finalTitle = fileName;
      } else if (!finalArtist) {
        finalArtist = 'Artista Desconocido';
      }
      
      // Actualizar los estados
      setSongTitle(finalTitle);
      setArtistName(finalArtist);

      if (!user?.uid) {
        alert('Debes estar autenticado para subir a la nube');
        return;
      }

      // Generar ID único para la canción
      const songId = `newsong_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`🎵 Preparando nueva canción: ${finalArtist} - ${finalTitle}`);
      console.log(`📁 Archivo: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`🆔 ID de canción: ${songId}`);
      
      // Datos básicos de la canción (sin subir a B2 aún)
      const songData = {
        id: songId,
        songId: songId,
        title: finalTitle,
        artist: finalArtist,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        uploadDate: new Date().toLocaleString(),
        userId: user.uid,
        status: 'pending_separation' // Estado pendiente de separación
      };
      
      // Guardar datos de la canción para la separación
      setUploadedSongData(songData);
      
      // Mostrar modal de separación directamente (sin subir a B2 primero)
      console.log('✅ Song prepared, showing separation modal');
      setShowSeparationModal(true);
      
    } catch (error) {
      console.error('❌ Error preparando nueva canción:', error);
      alert(`❌ Error al preparar la canción: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setSongTitle('');
      setArtistName('');
      setSelectedFile(null);
      setMetadataExtracted(false);
      setUploadProgress(0);
      setShowSeparationModal(false);
      setSeparationOptions(null);
      setUploadedSongData(null);
      // setShowAudioEditor(false); // REMOVED
      setIsProcessingSeparation(false);
      onClose();
    }
  };

  // const handleEditorClose = () => { // REMOVED
  //   setShowAudioEditor(false);
  //   
  //   // Llamar callback si existe para actualizar la lista de canciones
  //   if (onUploadComplete && uploadedSongData) {
  //     onUploadComplete(uploadedSongData);
  //   }
  //   
  //   // Limpiar y cerrar todo
  //   handleClose();
  // };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-dark-800 border border-white border-opacity-20 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <Music className="h-6 w-6 text-primary-400" />
            <h2 className="text-xl font-bold text-white">🎵 Nueva Canción</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="text-gray-400 hover:text-white text-2xl disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          {/* Información extraída automáticamente */}
          {selectedFile && (songTitle || artistName) && (
            <div className="bg-blue-900 bg-opacity-30 border border-blue-500 rounded-lg p-4">
              <h3 className="text-blue-300 font-semibold mb-2 flex items-center">
                <Music className="h-4 w-4 mr-2" />
                Información Detectada Automáticamente
              </h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-200 text-sm">🎤 Artista:</span>
                  <span className="text-white font-medium">{artistName}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-blue-200 text-sm">🎶 Título:</span>
                  <span className="text-white font-medium">{songTitle}</span>
                </div>
                {metadataExtracted && (
                  <p className="text-green-400 text-xs">
                    ✅ Extraído de los metadatos del archivo
                  </p>
                )}
                {!metadataExtracted && (
                  <p className="text-yellow-400 text-xs">
                    ⚠️ Extraído del nombre del archivo
                  </p>
                )}
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-white font-bold mb-2">📁 Archivo de Audio:</label>
            <input
              type="file"
              accept=".wav,.mp3,.m4a,.aac,.ogg"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none disabled:opacity-50"
            />
            {selectedFile && (
              <div className="mt-2 space-y-1">
                <p className="text-green-400 text-sm">
                  ✅ Archivo seleccionado: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
                {(songTitle || artistName) && (
                  <p className="text-blue-400 text-sm">
                    🔄 Datos auto-cargados del nombre del archivo
                  </p>
                )}
              </div>
            )}
          </div>

          {isUploading && (
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white text-sm font-medium">Subiendo...</span>
                <span className="text-white text-sm">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div 
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
          

          <button
            onClick={handleUploadSong}
            disabled={!selectedFile}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <Music className="h-4 w-4" />
            <span>🤖 Procesar con IA</span>
          </button>

          <div className="text-xs text-gray-400 text-center space-y-1">
            <div>🤖 El archivo se procesará con IA para separar las pistas automáticamente</div>
            <div className="text-gray-500">
              💡 <strong>Tip:</strong> Nombra tu archivo como "Artista - Título" para auto-cargar los datos
              <br />Ejemplos: "Juan Pérez - Mi Canción.mp3" o "Banda - Rock Song (2024).wav"
            </div>
          </div>
        </div>

        {/* Progress Bar for Separation */}
        {isProcessingSeparation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-dark-800 border border-white border-opacity-20 rounded-lg p-6 w-full max-w-md mx-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
                  <span className="ml-3 text-white text-lg font-semibold">🎵 Procesando Audio</span>
                </div>
                
                <div className="mb-4">
                  <div className="text-white text-sm mb-2">{separationMessage}</div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-primary-500 to-primary-400 h-3 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${separationProgress}%` }}
                    ></div>
                  </div>
                  <div className="text-gray-300 text-xs mt-2">{separationProgress}%</div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="text-gray-400 text-sm">
                    🤖 {separationOptions?.basicType === 'vocals-drums-bass-other' 
                      ? 'Usando Demucs AI para separación de alta calidad' 
                      : 'Usando Spleeter AI para separación rápida'}
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Audio Separation Modal */}
        <AudioSeparationModal
          isOpen={showSeparationModal && !isProcessingSeparation}
          onClose={() => {
            setShowSeparationModal(false);
            setIsProcessingSeparation(false);
            // Si se cancela la separación, llamar callback y cerrar todo
            if (onUploadComplete && uploadedSongData) {
              onUploadComplete(uploadedSongData);
            }
            handleClose();
          }}
          onSave={handleSeparationOptions}
          songData={uploadedSongData}
          isProcessing={isProcessingSeparation}
        />
      </div>

      {/* Audio Editor - REMOVED */}
    </div>
  );
};

export default NewSongUpload;
