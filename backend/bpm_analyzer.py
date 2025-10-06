"""
BPM Analyzer - Cálculo profesional de tempo usando múltiples métodos
Basado en técnicas usadas en DAWs profesionales
"""

import librosa
import numpy as np
from typing import Dict, Optional
import tempfile
import os

class BPMAnalyzer:
    """
    Analizador profesional de BPM que combina múltiples técnicas
    para obtener resultados precisos similar a DAWs profesionales
    """
    
    def __init__(self):
        self.min_bpm = 60
        self.max_bpm = 200
        
    def analyze_bpm(self, file_path: str) -> Dict:
        """
        Analiza el BPM de un archivo de audio usando múltiples métodos
        y devuelve el resultado más confiable
        
        Args:
            file_path: Ruta al archivo de audio
            
        Returns:
            Dict con el BPM calculado y métricas de confianza
        """
        try:
            print(f"[BPM] Analizando BPM de: {file_path}")
            
            # Cargar audio
            y, sr = librosa.load(file_path, duration=120)  # Analizar primeros 2 minutos
            print(f"[OK] Audio cargado: SR={sr}, duracion={len(y)/sr:.2f}s")
            
            # Método 1: Beat tracking básico (librosa default)
            tempo_basic, beats_basic = librosa.beat.beat_track(y=y, sr=sr)
            print(f"[1] Metodo 1 (Basic): {tempo_basic:.1f} BPM")
            
            # Método 2: Onset strength envelope + Tempogram
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            tempo_onset = librosa.feature.tempo(onset_envelope=onset_env, sr=sr)[0]
            print(f"[2] Metodo 2 (Onset): {tempo_onset:.1f} BPM")
            
            # Método 3: Beat tracking con agregación
            tempo_aggregated, beats_agg = librosa.beat.beat_track(
                y=y, sr=sr,
                start_bpm=120,
                trim=True
            )
            print(f"[3] Metodo 3 (Aggregated): {tempo_aggregated:.1f} BPM")
            
            # Método 4: Análisis de ventanas múltiples (más robusto)
            tempos_windows = []
            window_duration = 30  # 30 segundos por ventana
            hop_duration = 15  # Salto de 15 segundos
            
            total_samples = len(y)
            window_samples = int(window_duration * sr)
            hop_samples = int(hop_duration * sr)
            
            for start in range(0, total_samples - window_samples, hop_samples):
                end = start + window_samples
                y_window = y[start:end]
                
                try:
                    tempo_window, _ = librosa.beat.beat_track(y=y_window, sr=sr)
                    if self.min_bpm <= tempo_window <= self.max_bpm:
                        tempos_windows.append(tempo_window)
                except:
                    continue
            
            if tempos_windows:
                tempo_multiwindow = np.median(tempos_windows)
                print(f"[4] Metodo 4 (Multi-window): {tempo_multiwindow:.1f} BPM ({len(tempos_windows)} ventanas)")
            else:
                tempo_multiwindow = tempo_basic
            
            # Método 5: Análisis percusivo (enfoque en batería)
            try:
                y_harmonic, y_percussive = librosa.effects.hpss(y)
                tempo_percussive, _ = librosa.beat.beat_track(y=y_percussive, sr=sr)
                print(f"[5] Metodo 5 (Percussive): {tempo_percussive:.1f} BPM")
            except:
                tempo_percussive = tempo_basic
            
            # Combinar todos los métodos con ponderación
            tempos = [tempo_basic, tempo_onset, tempo_aggregated, tempo_multiwindow, tempo_percussive]
            tempos_valid = [t for t in tempos if self.min_bpm <= t <= self.max_bpm]
            
            if not tempos_valid:
                tempos_valid = tempos
            
            # Calcular BPM final usando mediana (más robusto que promedio)
            final_bpm = np.median(tempos_valid)
            
            # Si el BPM parece ser la mitad o el doble, corregir
            final_bpm = self._correct_octave_errors(final_bpm, tempos_valid)
            
            # Calcular métricas de confianza
            std_dev = np.std(tempos_valid)
            confidence = max(0, 1 - (std_dev / 50))  # Confianza basada en variación
            
            # Redondear a entero
            final_bpm = int(round(final_bpm))
            
            result = {
                "bpm": final_bpm,
                "confidence": float(confidence),
                "methods": {
                    "basic": float(tempo_basic),
                    "onset": float(tempo_onset),
                    "aggregated": float(tempo_aggregated),
                    "multiwindow": float(tempo_multiwindow),
                    "percussive": float(tempo_percussive)
                },
                "std_deviation": float(std_dev),
                "all_tempos": [float(t) for t in tempos_valid]
            }
            
            print(f"[FINAL] BPM FINAL: {final_bpm} BPM (confianza: {confidence*100:.1f}%)")
            return result
            
        except Exception as e:
            print(f"[ERROR] Error analizando BPM: {e}")
            return {
                "bpm": None,
                "error": str(e),
                "confidence": 0
            }
    
    def _correct_octave_errors(self, bpm: float, all_tempos: list) -> float:
        """
        Corrige errores comunes donde el BPM detectado es la mitad o el doble del real
        Mejorado para ser más inteligente con música moderna
        """
        # Verificar si la mayoría de métodos están cerca del doble o mitad
        doubled = bpm * 2
        halved = bpm / 2
        
        # Contar cuántos tempos están cerca de cada opción
        count_original = sum(1 for t in all_tempos if abs(t - bpm) < 5)
        count_doubled = sum(1 for t in all_tempos if abs(t - doubled) < 5)
        count_halved = sum(1 for t in all_tempos if abs(t - halved) < 5)
        
        # Estrategia 1: Si hay más votos por el doble o mitad, usarlo
        if count_doubled > count_original and self.min_bpm <= doubled <= self.max_bpm:
            print(f"[FIX] Corrigiendo BPM por votos: {bpm:.1f} -> {doubled:.1f} (detectado como mitad)")
            return doubled
        elif count_halved > count_original and self.min_bpm <= halved <= self.max_bpm:
            print(f"[FIX] Corrigiendo BPM por votos: {bpm:.1f} -> {halved:.1f} (detectado como doble)")
            return halved
        
        # Estrategia 2: Corrección inteligente basada en rangos comunes
        # La mayoría de música moderna está entre 90-180 BPM
        if bpm < 85 and doubled <= 200:
            # BPM muy bajo, probablemente es la mitad
            print(f"[FIX] Corrigiendo BPM por rango bajo: {bpm:.1f} -> {doubled:.1f}")
            return doubled
        elif bpm > 185 and halved >= 60:
            # BPM muy alto, probablemente es el doble
            print(f"[FIX] Corrigiendo BPM por rango alto: {bpm:.1f} -> {halved:.1f}")
            return halved
        
        # Estrategia 3: Análisis de "sweet spots" musicales
        # Géneros comunes tienen BPMs en estos rangos:
        # EDM/Dance: 120-140, Hip-Hop: 80-110, Rock: 110-140, Pop: 100-130
        sweet_spots = [
            (120, 140, 2.0),  # EDM/Dance - peso alto
            (80, 110, 1.5),   # Hip-Hop - peso medio
            (110, 140, 1.5),  # Rock/Pop - peso medio
            (140, 160, 1.0),  # Uptempo - peso normal
        ]
        
        scores = {
            'original': 0,
            'doubled': 0,
            'halved': 0
        }
        
        for min_range, max_range, weight in sweet_spots:
            if min_range <= bpm <= max_range:
                scores['original'] += weight
            if min_range <= doubled <= max_range:
                scores['doubled'] += weight
            if min_range <= halved <= max_range:
                scores['halved'] += weight
        
        # Si el doble tiene mucho mejor score y está en rango válido
        if scores['doubled'] > scores['original'] * 1.3 and self.min_bpm <= doubled <= self.max_bpm:
            print(f"[FIX] Corrigiendo BPM por sweet spot: {bpm:.1f} -> {doubled:.1f} (score: {scores['doubled']:.1f} vs {scores['original']:.1f})")
            return doubled
        elif scores['halved'] > scores['original'] * 1.3 and self.min_bpm <= halved <= self.max_bpm:
            print(f"[FIX] Corrigiendo BPM por sweet spot: {bpm:.1f} -> {halved:.1f} (score: {scores['halved']:.1f} vs {scores['original']:.1f})")
            return halved
        
        return bpm
    
    def analyze_from_url(self, audio_url: str) -> Dict:
        """
        Analiza BPM desde una URL de audio descargándolo temporalmente
        """
        try:
            # Usar urllib en lugar de requests (viene con Python)
            from urllib.request import urlopen
            
            # Descargar archivo temporal
            with urlopen(audio_url) as response:
                data = response.read()
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp_file:
                tmp_file.write(data)
                tmp_path = tmp_file.name
            
            # Analizar
            result = self.analyze_bpm(tmp_path)
            
            # Limpiar
            os.unlink(tmp_path)
            
            return result
            
        except Exception as e:
            print(f"[ERROR] Error descargando/analizando desde URL: {e}")
            import traceback
            traceback.print_exc()
            return {
                "bpm": None,
                "error": str(e),
                "confidence": 0
            }


# Instancia global
bpm_analyzer = BPMAnalyzer()

