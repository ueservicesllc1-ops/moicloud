/**
 * audio-cleanup.js - Script para limpiar audio del sistema
 * Se ejecuta automáticamente en el navegador
 */

(function() {
  'use strict';
  
  console.log('🎵 Audio Cleanup Script iniciado');
  
  // Función para limpiar todo el audio del sistema
  function cleanupSystemAudio() {
    console.log('🛑 LIMPIEZA SISTEMA DE AUDIO');
    
    try {
      // Detener todos los elementos de audio
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach((audio, index) => {
        console.log(`⏹️ STOPPING audio ${index + 1}`);
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.load();
        audio.removeAttribute('src');
      });
      
      // Detener todos los elementos de video
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach((video, index) => {
        console.log(`⏹️ STOPPING video ${index + 1}`);
        video.pause();
        video.currentTime = 0;
        video.src = '';
        video.load();
        video.removeAttribute('src');
      });
      
      // Cerrar todos los AudioContext
      if (window.AudioContext || window.webkitAudioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        if (audioContext.state !== 'closed') {
          audioContext.close();
          console.log('🎵 AudioContext cerrado');
        }
      }
      
      // Limpiar MediaSource
      if (window.MediaSource) {
        try {
          const mediaSource = new MediaSource();
          if (mediaSource.readyState === 'open') {
            mediaSource.endOfStream();
          }
        } catch (e) {
          console.log('Error cerrando MediaSource:', e);
        }
      }
      
      // Cancelar todas las peticiones fetch activas
      if (window.AbortController) {
        // Cancelar peticiones de separación de audio
        const abortControllers = window.activeAbortControllers || [];
        abortControllers.forEach(controller => {
          controller.abort();
        });
        window.activeAbortControllers = [];
        console.log('🚫 Canceladas peticiones activas');
      }
      
      // Limpiar caché de audio
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            if (cacheName.includes('audio') || cacheName.includes('media')) {
              caches.delete(cacheName);
            }
          });
        });
      }
      
      console.log('✅ LIMPIEZA SISTEMA COMPLETADA');
      
    } catch (error) {
      console.error('Error en limpieza de sistema:', error);
    }
  }
  
  // Ejecutar limpieza inmediatamente
  cleanupSystemAudio();
  
  // Limpiar antes de cerrar la ventana
  window.addEventListener('beforeunload', cleanupSystemAudio);
  window.addEventListener('unload', cleanupSystemAudio);
  document.addEventListener('beforeunload', cleanupSystemAudio);
  
  // Limpiar cuando la pestaña se oculta
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      cleanupSystemAudio();
    }
  });
  
  // Limpiar cuando se pierde el foco
  window.addEventListener('blur', cleanupSystemAudio);
  
  // Exponer función globalmente
  window.stopAllSystemAudio = cleanupSystemAudio;
  
  console.log('🎵 Audio Cleanup Script configurado');
})();

