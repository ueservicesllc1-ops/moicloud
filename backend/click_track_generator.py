"""
Generador de Click Track (Metronome) para Moises Clone
Genera audio real del metronome usando samples de audio y detección de beats
"""

import numpy as np
import soundfile as sf
import tempfile
import os
from pathlib import Path
import asyncio
import aiohttp
import aiofiles
from typing import Dict, Optional
import librosa
from pydub import AudioSegment
from pydub.generators import Sine

class ClickTrackGenerator:
    def __init__(self):
        self.sample_rate = 44100
        self.click_frequency = 800  # Hz
        self.click_duration = 0.1  # 100ms
        self.volume = 0.3  # Volumen del click
        
    def generate_click_track_from_audio(self, audio_file_path: str, output_path: str) -> bool:
        """
        Genera click track profesional detectando beats reales de la canción
        """
        try:
            print(f"[CLICK] Generando click track profesional desde: {audio_file_path}")
            
            # 1. Cargar la canción
            y, sr = librosa.load(audio_file_path)
            duration = len(y) / sr
            print(f"[CLICK] Canción cargada: {duration:.2f}s, SR: {sr}")
            
            # 2. Detectar tempo y beats reales
            tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
            beat_times = librosa.frames_to_time(beats, sr=sr)
            
            print(f"[CLICK] Tempo detectado: {tempo:.2f} BPM")
            print(f"[CLICK] Beats detectados: {len(beat_times)}")
            
            # 3. Crear samples de click profesional
            click_sample = self._create_click_sample()
            accent_sample = self._create_accent_sample()
            
            # 4. Crear track vacío con la duración de la canción
            track_duration_ms = int(duration * 1000)
            click_track = AudioSegment.silent(duration=track_duration_ms)
            
            # 5. Insertar clicks en cada beat detectado
            compas = 4  # Compás de 4/4
            for i, beat_time in enumerate(beat_times):
                pos_ms = int(beat_time * 1000)  # Convertir a milisegundos
                
                if i % compas == 0:  # Primer tiempo del compás → acento
                    click_track = click_track.overlay(accent_sample, position=pos_ms)
                    print(f"[CLICK] Acento en beat {i}: {beat_time:.2f}s")
                else:  # Otros tiempos → click normal
                    click_track = click_track.overlay(click_sample, position=pos_ms)
            
            # 6. Exportar resultado
            click_track.export(output_path, format="wav")
            print(f"[CLICK] Click track profesional guardado: {output_path}")
            return True
            
        except Exception as e:
            print(f"[CLICK] Error generando click track profesional: {e}")
            import traceback
            print(f"[CLICK] Stack trace: {traceback.format_exc()}")
            return False
    
    def generate_click_track(self, bpm: float, duration: float, output_path: str) -> bool:
        """
        Genera un click track completo basado en BPM y duración (método simple)
        """
        try:
            print(f"[CLICK] Generando click track simple: BPM={bpm}, Duración={duration}s")
            
            # Calcular número de beats
            beats_per_second = bpm / 60.0
            total_beats = int(duration * beats_per_second)
            
            # Generar array de audio
            total_samples = int(duration * self.sample_rate)
            audio_data = np.zeros(total_samples, dtype=np.float32)
            
            # Generar cada click
            for beat in range(total_beats):
                beat_time = beat / beats_per_second
                sample_start = int(beat_time * self.sample_rate)
                sample_end = min(sample_start + int(self.click_duration * self.sample_rate), total_samples)
                
                if sample_start < total_samples:
                    # Generar click individual
                    click_samples = self._generate_single_click(sample_end - sample_start)
                    audio_data[sample_start:sample_end] += click_samples
            
            # Normalizar audio
            if np.max(np.abs(audio_data)) > 0:
                audio_data = audio_data / np.max(np.abs(audio_data)) * self.volume
            
            # Guardar archivo
            sf.write(output_path, audio_data, self.sample_rate)
            print(f"[CLICK] Click track guardado: {output_path}")
            return True
            
        except Exception as e:
            print(f"[CLICK] Error generando click track: {e}")
            return False
    
    def _generate_single_click(self, num_samples: int) -> np.ndarray:
        """
        Genera un click individual con envelope ADSR
        """
        if num_samples <= 0:
            return np.array([])
        
        # Generar sine wave
        t = np.linspace(0, self.click_duration, num_samples)
        sine_wave = np.sin(2 * np.pi * self.click_frequency * t)
        
        # Aplicar envelope ADSR
        envelope = self._generate_adsr_envelope(num_samples)
        
        return sine_wave * envelope
    
    def _generate_adsr_envelope(self, num_samples: int) -> np.ndarray:
        """
        Genera envelope ADSR para el click
        """
        envelope = np.zeros(num_samples)
        
        # Attack: 10% del click
        attack_samples = int(0.1 * num_samples)
        if attack_samples > 0:
            envelope[:attack_samples] = np.linspace(0, 1, attack_samples)
        
        # Decay: 90% del click
        decay_samples = num_samples - attack_samples
        if decay_samples > 0:
            decay_start = attack_samples
            decay_end = num_samples
            envelope[decay_start:decay_end] = np.exp(-np.linspace(0, 5, decay_samples))
        
        return envelope
    
    def _create_click_sample(self) -> AudioSegment:
        """
        Crea un sample de click profesional usando Pydub
        """
        try:
            # Crear click con múltiples frecuencias para sonido más rico
            click_duration = 100  # 100ms
            
            # Frecuencia principal (800Hz) + armónicos
            click = Sine(800).to_audio_segment(duration=click_duration)
            click += Sine(1600).to_audio_segment(duration=click_duration) * 0.3  # Armónico
            click += Sine(400).to_audio_segment(duration=click_duration) * 0.2   # Subarmónico
            
            # Aplicar envelope ADSR
            click = click.fade_in(5).fade_out(95)  # Attack rápido, decay largo
            
            # Normalizar volumen
            click = click - 6  # Reducir volumen
            
            return click
            
        except Exception as e:
            print(f"[CLICK] Error creando click sample: {e}")
            # Fallback: click simple
            return Sine(800).to_audio_segment(duration=100) - 6
    
    def _create_accent_sample(self) -> AudioSegment:
        """
        Crea un sample de acento más fuerte y rico
        """
        try:
            # Crear acento con más frecuencias y volumen
            accent_duration = 120  # 120ms (más largo que click normal)
            
            # Múltiples frecuencias para sonido más rico
            accent = Sine(1000).to_audio_segment(duration=accent_duration)  # Frecuencia principal más alta
            accent += Sine(2000).to_audio_segment(duration=accent_duration) * 0.4  # Armónico
            accent += Sine(500).to_audio_segment(duration=accent_duration) * 0.3   # Subarmónico
            accent += Sine(3000).to_audio_segment(duration=accent_duration) * 0.2  # Armónico alto
            
            # Aplicar envelope más suave
            accent = accent.fade_in(10).fade_out(110)
            
            # Volumen más alto que el click normal
            accent = accent + 3  # 3dB más alto
            
            return accent
            
        except Exception as e:
            print(f"[CLICK] Error creando accent sample: {e}")
            # Fallback: acento simple
            return (Sine(1000).to_audio_segment(duration=120) + 3)
    
    async def upload_click_track_to_b2(self, file_path: str, user_id: str, song_id: str) -> Optional[str]:
        """
        Sube el click track a B2 y retorna la URL
        """
        try:
            print(f"[CLICK] Subiendo click track a B2: {file_path}")
            
            # Leer archivo
            async with aiofiles.open(file_path, 'rb') as f:
                file_data = await f.read()
            
            # Crear FormData
            form_data = aiohttp.FormData()
            form_data.add_field('file', file_data, filename='click.wav', content_type='audio/wav')
            form_data.add_field('userId', user_id)
            form_data.add_field('songId', song_id)
            form_data.add_field('trackName', 'click')
            form_data.add_field('folder', 'stems')
            
            # Subir a B2 via proxy
            async with aiohttp.ClientSession() as session:
                async with session.post('http://localhost:3001/api/upload', data=form_data) as response:
                    if response.status == 200:
                        result = await response.json()
                        b2_url = result.get('downloadUrl', '')
                        print(f"[CLICK] Click track subido a B2: {b2_url}")
                        return b2_url
                    else:
                        print(f"[CLICK] Error subiendo a B2: {response.status}")
                        return None
                        
        except Exception as e:
            print(f"[CLICK] Error subiendo click track: {e}")
            return None
    
    async def generate_and_upload_click_track(self, bpm: float, duration: float, user_id: str, song_id: str, audio_file_path: str = None) -> Optional[str]:
        """
        Genera click track profesional y lo sube a B2
        """
        try:
            # Crear archivo temporal
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                temp_path = tmp_file.name
            
            # Usar método profesional si tenemos el archivo de audio
            if audio_file_path and os.path.exists(audio_file_path):
                print(f"[CLICK] Usando método profesional con archivo: {audio_file_path}")
                success = self.generate_click_track_from_audio(audio_file_path, temp_path)
            else:
                print(f"[CLICK] Usando método simple con BPM: {bpm}")
                success = self.generate_click_track(bpm, duration, temp_path)
            
            if not success:
                return None
            
            # Subir a B2
            b2_url = await self.upload_click_track_to_b2(temp_path, user_id, song_id)
            
            # Limpiar archivo temporal
            try:
                os.unlink(temp_path)
            except:
                pass
            
            return b2_url
            
        except Exception as e:
            print(f"[CLICK] Error en proceso completo: {e}")
            import traceback
            print(f"[CLICK] Stack trace: {traceback.format_exc()}")
            return None

# Instancia global
click_generator = ClickTrackGenerator()
