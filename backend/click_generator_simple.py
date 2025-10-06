"""
Generador de click track simple usando archivos de audio
"""

from pydub import AudioSegment
import os

class ClickGeneratorSimple:
    def __init__(self):
        pass
    
    def generate_click_track(
        self, 
        bpm: int, 
        duration_seconds: float,
        click_path: str,
        click2_path: str,
        time_signature: str = "4/4",
        output_path: str = None,
        onset_offset_seconds: float = 0.0
    ) -> str:
        """
        Genera un click track usando archivos de audio, alineado con el onset de la canción
        
        Args:
            bpm: Tempo en BPM
            duration_seconds: Duración en segundos
            click_path: Ruta al archivo de click normal
            click2_path: Ruta al archivo de click acentuado (downbeat)
            time_signature: Compás (ej: "4/4", "3/4")
            output_path: Ruta donde guardar el resultado
            onset_offset_seconds: Tiempo en segundos hasta el primer ataque de la canción
            
        Returns:
            Ruta del archivo generado
        """
        print(f"[CLICK] Generando click track: {bpm} BPM, {duration_seconds}s, {time_signature}")
        
        try:
            # Cargar archivos de click
            if not os.path.exists(click_path):
                raise FileNotFoundError(f"Archivo click no encontrado: {click_path}")
            if not os.path.exists(click2_path):
                raise FileNotFoundError(f"Archivo click2 no encontrado: {click2_path}")
            
            click_normal = AudioSegment.from_wav(click_path)
            click_accent = AudioSegment.from_wav(click2_path)
            
            print(f"[CLICK] Archivos cargados: {len(click_normal)}ms, {len(click_accent)}ms")
            
            # Parsear time signature
            beats_per_measure = int(time_signature.split('/')[0])
            
            # Calcular intervalo entre clicks (en milisegundos)
            beat_interval_ms = (60.0 / bpm) * 1000
            
            # ONSET OFFSET: Silencio inicial (igual que los otros tracks)
            onset_offset_ms = int(onset_offset_seconds * 1000)
            
            print(f"[CLICK] Intervalo entre beats: {beat_interval_ms}ms, Beats por compás: {beats_per_measure}")
            print(f"[CLICK] Onset offset: {onset_offset_ms}ms (silencio inicial igual que otros tracks)")
            
            # Crear click track CON el mismo silencio inicial que los otros tracks
            # Así todos están sincronizados desde el inicio
            total_duration_ms = int(duration_seconds * 1000)
            click_track = AudioSegment.silent(duration=total_duration_ms)
            
            print(f"[CLICK] Duración click track: {total_duration_ms}ms (con silencio inicial)")
            
            # Agregar clicks DESDE EL ONSET (donde está el primer ataque de audio)
            current_time_ms = onset_offset_ms
            print(f"[CLICK] Primer click en: {onset_offset_ms}ms (coincide con primer ataque de audio)")
            beat_number = 1
            
            # Preparar clicks con diferentes volúmenes
            # 70% de volumen ≈ -3.5 dB
            click_normal_reduced = click_normal - 3.5  # Reducir volumen a ~70%
            
            while current_time_ms < total_duration_ms:
                # Determinar qué click usar según posición en el compás
                if beat_number == 1:
                    # Primer beat del compás: acento fuerte (click2 al 100%)
                    click_to_use = click_accent
                    print(f"[CLICK DEBUG] Beat {beat_number}/{beats_per_measure} @ {current_time_ms:.0f}ms - ACENTO (100%)")
                else:
                    # Beats intermedios: click normal al 70%
                    click_to_use = click_normal_reduced
                    if beat_number <= 5:  # Solo log para los primeros beats
                        print(f"[CLICK DEBUG] Beat {beat_number}/{beats_per_measure} @ {current_time_ms:.0f}ms - Normal (70%)")
                
                # Superponer el click en la posición actual
                click_track = click_track.overlay(click_to_use, position=int(current_time_ms))
                
                # Avanzar al siguiente beat
                current_time_ms += beat_interval_ms
                beat_number += 1
                
                # Reiniciar contador de beats
                if beat_number > beats_per_measure:
                    beat_number = 1
            
            # Generar nombre de archivo si no se proporciona
            if output_path is None:
                import tempfile
                output_path = os.path.join(tempfile.gettempdir(), f"click_track_{bpm}bpm.wav")
            
            # Exportar
            click_track.export(output_path, format="wav")
            print(f"[CLICK] Click track generado: {output_path}")
            
            return output_path
            
        except Exception as e:
            print(f"[CLICK] Error: {e}")
            import traceback
            traceback.print_exc()
            raise e

# Instancia global
click_generator_simple = ClickGeneratorSimple()

