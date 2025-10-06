"""
Chord Analyzer - Detección de acordes y análisis de tonalidad
Basado en las funcionalidades de Moises.ai
"""

import librosa
import numpy as np
from typing import Dict, List, Tuple, Optional
import json
from dataclasses import dataclass

@dataclass
class ChordInfo:
    chord: str
    confidence: float
    start_time: float
    end_time: float
    root_note: str
    chord_type: str

@dataclass
class KeyInfo:
    key: str
    mode: str  # major, minor
    confidence: float
    tonic: str

class ChordAnalyzer:
    def __init__(self):
        # Mapeo de notas
        self.note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        self.chord_types = {
            'major': [0, 4, 7],
            'minor': [0, 3, 7],
            'diminished': [0, 3, 6],
            'augmented': [0, 4, 8],
            'sus2': [0, 2, 7],
            'sus4': [0, 5, 7],
            'major7': [0, 4, 7, 11],
            'minor7': [0, 3, 7, 10],
            'dominant7': [0, 4, 7, 10],
            'minor7b5': [0, 3, 6, 10],
            'major9': [0, 4, 7, 11, 2],
            'minor9': [0, 3, 7, 10, 2],
            'add9': [0, 4, 7, 2],
            '6': [0, 4, 7, 9],
            'minor6': [0, 3, 7, 9]
        }
    
    def analyze_chords(self, audio_path: str, hop_length: int = 512) -> List[ChordInfo]:
        """
        Analiza los acordes de un archivo de audio
        """
        try:
            # Cargar audio
            y, sr = librosa.load(audio_path, sr=22050)
            
            # Extraer características cromáticas
            chroma = librosa.feature.chroma_stft(y=y, sr=sr, hop_length=hop_length)
            
            # Detectar segmentos de acordes
            chord_segments = self._detect_chord_segments(chroma, sr, hop_length)
            
            # Analizar cada segmento
            chords = []
            for segment in chord_segments:
                chord_info = self._analyze_chord_segment(chroma, segment)
                if chord_info:
                    chords.append(chord_info)
            
            return chords
            
        except Exception as e:
            print(f"Error analyzing chords: {e}")
            return []
    
    def _detect_chord_segments(self, chroma: np.ndarray, sr: int, hop_length: int) -> List[Tuple[int, int]]:
        """
        Detecta segmentos donde hay cambios de acordes
        """
        # Calcular la distancia entre frames consecutivos
        chroma_diff = np.diff(chroma, axis=1)
        chroma_distance = np.linalg.norm(chroma_diff, axis=0)
        
        # Encontrar picos de cambio
        threshold = np.mean(chroma_distance) + np.std(chroma_distance)
        change_points = np.where(chroma_distance > threshold)[0]
        
        # Crear segmentos
        segments = []
        start = 0
        for change_point in change_points:
            if change_point - start > 10:  # Mínimo 10 frames
                segments.append((start, change_point))
                start = change_point
        
        # Agregar último segmento
        if chroma.shape[1] - start > 10:
            segments.append((start, chroma.shape[1]))
        
        return segments
    
    def _analyze_chord_segment(self, chroma: np.ndarray, segment: Tuple[int, int]) -> Optional[ChordInfo]:
        """
        Analiza un segmento específico para detectar el acorde
        """
        start_frame, end_frame = segment
        segment_chroma = chroma[:, start_frame:end_frame]
        
        # Promediar el cromagrama del segmento
        avg_chroma = np.mean(segment_chroma, axis=1)
        
        # Encontrar el acorde más probable
        best_chord, confidence = self._find_best_chord(avg_chroma)
        
        if confidence > 0.3:  # Umbral de confianza
            start_time = start_frame * 512 / 22050  # Convertir a tiempo
            end_time = end_frame * 512 / 22050
            
            return ChordInfo(
                chord=best_chord,
                confidence=confidence,
                start_time=start_time,
                end_time=end_time,
                root_note=best_chord.split()[0] if ' ' in best_chord else best_chord,
                chord_type=self._get_chord_type(best_chord)
            )
        
        return None
    
    def _find_best_chord(self, chroma_vector: np.ndarray) -> Tuple[str, float]:
        """
        Encuentra el acorde que mejor coincide con el vector cromático
        """
        best_chord = "C"
        best_score = 0.0
        
        # Probar cada nota raíz
        for root_idx in range(12):
            # Probar cada tipo de acorde
            for chord_type, intervals in self.chord_types.items():
                # Crear template del acorde
                chord_template = np.zeros(12)
                for interval in intervals:
                    note_idx = (root_idx + interval) % 12
                    chord_template[note_idx] = 1.0
                
                # Calcular similitud
                similarity = np.dot(chroma_vector, chord_template) / (np.linalg.norm(chroma_vector) * np.linalg.norm(chord_template))
                
                if similarity > best_score:
                    best_score = similarity
                    root_note = self.note_names[root_idx]
                    best_chord = f"{root_note} {chord_type}" if chord_type != 'major' else root_note
        
        return best_chord, best_score
    
    def _get_chord_type(self, chord: str) -> str:
        """
        Extrae el tipo de acorde del string
        """
        if ' ' in chord:
            return chord.split(' ', 1)[1]
        return 'major'
    
    def analyze_key(self, audio_path: str) -> Optional[KeyInfo]:
        """
        Analiza la tonalidad de la canción
        """
        try:
            y, sr = librosa.load(audio_path, sr=22050)
            
            # Extraer características cromáticas
            chroma = librosa.feature.chroma_stft(y=y, sr=sr)
            
            # Promediar a lo largo del tiempo
            avg_chroma = np.mean(chroma, axis=1)
            
            # Encontrar la tonalidad más probable
            key, mode, confidence = self._find_key(avg_chroma)
            
            return KeyInfo(
                key=key,
                mode=mode,
                confidence=confidence,
                tonic=key.split()[0] if ' ' in key else key
            )
            
        except Exception as e:
            print(f"Error analyzing key: {e}")
            return None
    
    def _find_key(self, chroma_vector: np.ndarray) -> Tuple[str, str, float]:
        """
        Encuentra la tonalidad usando el algoritmo de Krumhansl-Schmuckler
        """
        # Perfiles de tonalidad (Krumhansl-Schmuckler)
        major_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
        minor_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
        
        best_key = "C major"
        best_score = 0.0
        best_mode = "major"
        
        # Probar cada tonalidad
        for root_idx in range(12):
            # Rotar el perfil para cada nota raíz
            major_rotated = np.roll(major_profile, root_idx)
            minor_rotated = np.roll(minor_profile, root_idx)
            
            # Calcular correlación
            major_corr = np.corrcoef(chroma_vector, major_rotated)[0, 1]
            minor_corr = np.corrcoef(chroma_vector, minor_rotated)[0, 1]
            
            root_note = self.note_names[root_idx]
            
            if major_corr > best_score:
                best_score = major_corr
                best_key = f"{root_note} major"
                best_mode = "major"
            
            if minor_corr > best_score:
                best_score = minor_corr
                best_key = f"{root_note} minor"
                best_mode = "minor"
        
        return best_key, best_mode, best_score
    
    def get_chord_progression(self, chords: List[ChordInfo]) -> List[str]:
        """
        Extrae la progresión de acordes
        """
        progression = []
        for chord in chords:
            if chord.chord not in progression:
                progression.append(chord.chord)
        return progression
    
    def export_chord_data(self, chords: List[ChordInfo], key_info: Optional[KeyInfo], output_path: str):
        """
        Exporta los datos de acordes a JSON
        """
        data = {
            "chords": [
                {
                    "chord": chord.chord,
                    "confidence": chord.confidence,
                    "start_time": chord.start_time,
                    "end_time": chord.end_time,
                    "root_note": chord.root_note,
                    "chord_type": chord.chord_type
                }
                for chord in chords
            ],
            "key": {
                "key": key_info.key if key_info else "Unknown",
                "mode": key_info.mode if key_info else "Unknown",
                "confidence": key_info.confidence if key_info else 0.0,
                "tonic": key_info.tonic if key_info else "Unknown"
            } if key_info else None,
            "progression": self.get_chord_progression(chords)
        }
        
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)

