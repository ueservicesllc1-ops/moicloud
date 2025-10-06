/**
 * RealB2Service - Implementación usando Backend Proxy
 * Esta implementación usa un proxy backend para evitar problemas de CORS
 */

interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

class RealB2Service {
  private proxyUrl = 'http://localhost:3001'; // Puerto del proxy backend

  // Subir archivo usando proxy backend
  async uploadAudioFile(
    file: File,
    userId: string,
    onProgress?: (progress: UploadProgress) => void,
    songId?: string,
    trackName?: string
  ): Promise<string> {
    try {
      console.log('Starting upload via proxy backend...');
      
      if (onProgress) {
        onProgress({
          file,
          progress: 10,
          status: 'uploading'
        });
      }

      // Crear FormData para la subida
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);
      
      // Agregar songId y trackName si se proporcionan
      if (songId) {
        formData.append('songId', songId);
      }
      if (trackName) {
        formData.append('trackName', trackName);
      }
      
      // Si se proporciona songId y es para canciones nuevas, marcar como carpeta newsongs
      if (songId && songId.startsWith('newsong_')) {
        formData.append('folder', 'newsongs');
      }

      if (onProgress) {
        onProgress({
          file,
          progress: 30,
          status: 'uploading'
        });
      }

      console.log('Sending to proxy backend:', `${this.proxyUrl}/api/upload`);

      // Subir archivo usando proxy backend
      const response = await fetch(`${this.proxyUrl}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Upload response:', response.status, errorData);
        throw new Error(`Upload failed: ${response.status} ${errorData.message || errorData.error}`);
      }

      if (onProgress) {
        onProgress({
          file,
          progress: 80,
          status: 'uploading'
        });
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      
      if (onProgress) {
        onProgress({
          file,
          progress: 100,
          status: 'completed'
        });
      }

      console.log('File uploaded successfully:', result.downloadUrl);
      
      return result.downloadUrl;

    } catch (error) {
      console.error('B2 Proxy Upload error:', error);
      
      if (onProgress) {
        onProgress({
          file,
          progress: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed'
        });
      }
      throw error;
    }
  }

  // Validar archivo de audio
  validateAudioFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/m4a',
      'audio/aac',
      'audio/ogg',
      'audio/flac'
    ];

    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'El archivo es demasiado grande. Máximo 100MB.'
      };
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Tipo de archivo no soportado. Use MP3, WAV, M4A, AAC, OGG o FLAC.'
      };
    }

    return { valid: true };
  }

  // Obtener metadatos del archivo
  getFileMetadata(file: File) {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified)
    };
  }

  // Eliminar archivo
  async deleteAudioFile(fileUrl: string): Promise<void> {
    console.log('Delete file:', fileUrl);
    // Implementar eliminación si es necesario
  }
}

export default new RealB2Service();
