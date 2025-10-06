"""
Analizador de tonalidad (Key) usando librosa
Algoritmo basado en Krumhansl-Schmuckler
"""

import librosa
import numpy as np
from collections import Counter

class KeyAnalyzerSimple:
    # Perfiles de Krumhansl-Schmuckler para mayor y menor
    MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    
    KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    
    def __init__(self):
        pass
    
    def analyze_key_from_file(self, audio_path: str) -> dict:
        """
        Analiza la tonalidad de un archivo de audio
        
        Args:
            audio_path: Ruta al archivo de audio
            
        Returns:
            dict con key, scale (major/minor) y confidence
        """
        print(f"[KEY] Analizando tonalidad: {audio_path}")
        
        try:
            # Cargar audio
            y, sr = librosa.load(audio_path, duration=30, sr=22050)
            print(f"[KEY] Audio cargado: {len(y)/sr:.1f}s, SR: {sr}")
            
            # Extraer chroma (representación de las 12 notas)
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr, bins_per_octave=12*3)
            
            # Promediar en el tiempo para obtener un perfil de pitch
            chroma_mean = np.mean(chroma, axis=1)
            
            # Normalizar
            if np.sum(chroma_mean) > 0:
                chroma_mean = chroma_mean / np.sum(chroma_mean)
            
            print(f"[KEY] Chroma calculado, perfil: {chroma_mean[:6]}")
            
            # Probar todas las tonalidades (12 mayores + 12 menores)
            max_correlation = -1
            best_key = None
            best_scale = None
            
            # Probar tonalidades mayores
            for i in range(12):
                # Rotar el perfil mayor
                rotated_profile = np.roll(self.MAJOR_PROFILE, i)
                # Normalizar
                rotated_profile = rotated_profile / np.sum(rotated_profile)
                # Calcular correlación
                correlation = np.corrcoef(chroma_mean, rotated_profile)[0, 1]
                
                if correlation > max_correlation:
                    max_correlation = correlation
                    best_key = self.KEYS[i]
                    best_scale = 'major'
            
            # Probar tonalidades menores
            for i in range(12):
                # Rotar el perfil menor
                rotated_profile = np.roll(self.MINOR_PROFILE, i)
                # Normalizar
                rotated_profile = rotated_profile / np.sum(rotated_profile)
                # Calcular correlación
                correlation = np.corrcoef(chroma_mean, rotated_profile)[0, 1]
                
                if correlation > max_correlation:
                    max_correlation = correlation
                    best_key = self.KEYS[i]
                    best_scale = 'minor'
            
            # Convertir correlación a confianza (0-1)
            confidence = (max_correlation + 1) / 2  # Mapear de [-1, 1] a [0, 1]
            
            # Formato final
            key_str = f"{best_key} {'Major' if best_scale == 'major' else 'Minor'}"
            
            print(f"[KEY] Resultado: {key_str}, Confianza: {confidence*100:.1f}%")
            
            return {
                'key': best_key,
                'scale': best_scale,
                'key_string': key_str,
                'confidence': float(confidence)
            }
            
        except Exception as e:
            print(f"[KEY] Error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'key': None,
                'scale': None,
                'key_string': 'Unknown',
                'confidence': 0.0,
                'error': str(e)
            }

# Instancia global
key_analyzer_simple = KeyAnalyzerSimple()



