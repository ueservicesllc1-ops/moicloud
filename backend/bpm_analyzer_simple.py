#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Analizador de BPM simplificado - usa archivos locales en cache
"""

import librosa
import numpy as np
import os
from typing import Dict, Optional
from pathlib import Path

class SimpleBPMAnalyzer:
    def __init__(self):
        self.min_bpm = 60
        self.max_bpm = 200

    def analyze_bpm_from_file(self, file_path: str) -> Dict:
        """
        Analiza BPM de forma simple y rápida
        """
        try:
            print(f"[BPM] Analizando: {file_path}")
            
            if not os.path.exists(file_path):
                return {"bpm": None, "error": "Archivo no encontrado", "confidence": 0}
            
            # Verificar tamaño del archivo
            file_size = os.path.getsize(file_path)
            print(f"[BPM] Tamaño archivo: {file_size} bytes")
            
            if file_size < 1000:  # Archivo muy pequeño
                return {"bpm": None, "error": "Archivo muy pequeño", "confidence": 0}
            
            # Cargar audio con más opciones
            try:
                y, sr = librosa.load(file_path, sr=22050, duration=30)  # Reducir a 30 segundos
                print(f"[BPM] Audio cargado: {len(y)/sr:.1f}s, SR: {sr}")
                
                if len(y) < 1000:  # Audio muy corto
                    return {"bpm": None, "error": "Audio muy corto", "confidence": 0}
                
            except Exception as load_error:
                print(f"[BPM] Error cargando audio: {load_error}")
                return {"bpm": None, "error": f"Error cargando audio: {load_error}", "confidence": 0}
            
            # Múltiples métodos para mayor precisión
            tempos = []
            
            # Método 1: beat_track
            try:
                tempo1, _ = librosa.beat.beat_track(y=y, sr=sr)
                if tempo1 > 0:
                    tempos.append(float(tempo1))
                    print(f"[BPM] Método 1 (beat_track): {tempo1:.1f}")
            except Exception as e:
                print(f"[BPM] Error método 1: {e}")
            
            # Método 2: tempo con onset
            try:
                onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
                if len(onset_frames) > 1:
                    tempo2 = librosa.beat.tempo(onset_envelope=librosa.onset.onset_strength(y=y, sr=sr), sr=sr)
                    tempo2_value = float(tempo2[0]) if hasattr(tempo2, "__len__") else float(tempo2)
                    if tempo2_value > 0:
                        tempos.append(tempo2_value)
                        print(f"[BPM] Método 2 (onset): {tempo2_value:.1f}")
            except Exception as e:
                print(f"[BPM] Error método 2: {e}")
            
            # Método 3: tempo directo
            try:
                tempo3 = librosa.beat.tempo(y=y, sr=sr)
                tempo3_value = float(tempo3[0]) if hasattr(tempo3, "__len__") else float(tempo3)
                if tempo3_value > 0:
                    tempos.append(tempo3_value)
                    print(f"[BPM] Método 3 (tempo): {tempo3_value:.1f}")
            except Exception as e:
                print(f"[BPM] Error método 3: {e}")
            
            if not tempos:
                return {"bpm": None, "error": "No se pudo detectar tempo", "confidence": 0}
            
            # Promedio de los métodos que funcionaron
            avg_tempo = sum(tempos) / len(tempos)
            print(f"[BPM] Promedio: {avg_tempo:.1f}")
            
            # Corrección de octava mejorada
            if avg_tempo < 60:
                avg_tempo = avg_tempo * 2
                print(f"[BPM] Corregido (doblar): {avg_tempo:.1f}")
            elif avg_tempo > 200:
                avg_tempo = avg_tempo / 2
                print(f"[BPM] Corregido (mitad): {avg_tempo:.1f}")
            
            # Limitar a rango válido
            final_tempo = max(60, min(200, avg_tempo))
            
            print(f"[BPM] FINAL: {final_tempo:.1f}")
            
            return {
                "bpm": int(round(final_tempo)),
                "confidence": 0.9,  # Mayor confianza
                "details": {
                    "tempo": float(final_tempo),
                    "methods_used": len(tempos),
                    "raw_tempos": [float(t) for t in tempos]
                }
            }
            
        except Exception as e:
            print(f"[BPM] Error general: {e}")
            import traceback
            traceback.print_exc()
            return {"bpm": None, "error": str(e), "confidence": 0}
    

# Instancia global
bpm_analyzer_simple = SimpleBPMAnalyzer()
