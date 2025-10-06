/**
 * useAudioCleanup - Hook para limpiar completamente el audio
 */

import { useEffect } from 'react';

export const useAudioCleanup = () => {
  useEffect(() => {
    // Función global para limpiar todo el audio
    const cleanupAllAudio = () => {
      console.log('🛑 LIMPIEZA COMPLETA DE AUDIO');
      
      // Detener todos los elementos de audio
      const allAudioElements = document.querySelectorAll('audio');
      console.log(`🎵 STOPPING ${allAudioElements.length} elementos de audio del DOM`);
      
      allAudioElements.forEach((audio, index) => {
        console.log(`⏹️ STOPPING audio DOM ${index + 1}`);
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.load();
        audio.removeAttribute('src');
      });
      
      // Detener todos los elementos de video
      const allVideoElements = document.querySelectorAll('video');
      allVideoElements.forEach((video, index) => {
        console.log(`⏹️ STOPPING video DOM ${index + 1}`);
        video.pause();
        video.currentTime = 0;
        video.src = '';
        video.load();
        video.removeAttribute('src');
      });
      
      // Cerrar todos los AudioContext
      try {
        if (window.AudioContext) {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContext.close();
          console.log('🎵 AudioContext CERRADO');
        }
      } catch (e) {
        console.log('Error cerrando AudioContext:', e);
      }
      
      // Limpiar todos los MediaSource y SourceBuffers
      try {
        if (window.MediaSource) {
          const mediaSource = new MediaSource();
          if (mediaSource.readyState === 'open') {
            mediaSource.endOfStream();
          }
        }
      } catch (e) {
        console.log('Error cerrando MediaSource:', e);
      }
      
      // Forzar limpieza de caché de audio
      try {
        if ('caches' in window) {
          caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
              if (cacheName.includes('audio') || cacheName.includes('media')) {
                caches.delete(cacheName);
              }
            });
          });
        }
      } catch (e) {
        console.log('Error limpiando caché:', e);
      }
      
      // Limpiar todos los Web Audio API nodes
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext && typeof audioContext.close === 'function') {
          audioContext.close();
        }
      } catch (e) {
        console.log('Error cerrando Web Audio nodes:', e);
      }
      
      console.log('✅ LIMPIEZA COMPLETA TERMINADA');
    };

    // Exponer función globalmente
    (window as any).stopAllAudio = cleanupAllAudio;
    
    // Limpiar antes de cerrar la ventana
    const handleBeforeUnload = () => {
      console.log('🛑 VENTANA CERRÁNDOSE - LIMPIEZA DE AUDIO');
      cleanupAllAudio();
    };
    
    // Limpiar antes de que se cierre la pestaña
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('🛑 PESTAÑA OCULTA - LIMPIEZA DE AUDIO');
        cleanupAllAudio();
      }
    };
    
    // Agregar event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('beforeunload', handleBeforeUnload);
    
    // Limpiar al desmontar
    return () => {
      cleanupAllAudio();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
};

export default useAudioCleanup;
